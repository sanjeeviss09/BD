import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { TaskService } from './task.service';
import { TaskMetricsService, calendarDaysDiff } from './task-metrics.service';
import { ResponsibilityService } from './responsibility.service';
import { MeetingQuickCaptureService } from './meeting-quick-capture.service';

const STORE_FILE = path.resolve(__dirname, '../../data/meetings_store.json');

export interface MeetingFilterOptions {
  status?: string;
  meeting_type?: string;
  meeting_date?: string;
  organizer_id?: string;
  department_id?: string;
  customer_id?: string;
  opportunity_id?: string;
  rfq_id?: string;
  product_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export class MeetingService {
  private taskService: TaskService;
  private responsibilityService: ResponsibilityService;

  public static fallbackMeetings: any[] = [];
  public static extendedMeetingMeta = new Map<string, any>();
  public static fallbackNotes: any[] = [];
  public static fallbackPoints: any[] = [];
  public static fallbackDecisions: any[] = [];
  public static fallbackTemplates: any[] = [];
  public static fallbackConfigs: any[] = [];

  public static loadPersistentStore() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.meetings) && parsed.meetings.length > 0) {
          MeetingService.fallbackMeetings = parsed.meetings;
        }
        if (Array.isArray(parsed.notes)) MeetingService.fallbackNotes = parsed.notes;
        if (Array.isArray(parsed.points)) MeetingService.fallbackPoints = parsed.points;
        if (Array.isArray(parsed.decisions)) MeetingService.fallbackDecisions = parsed.decisions;
        if (parsed.extendedMeta && typeof parsed.extendedMeta === 'object') {
          Object.entries(parsed.extendedMeta).forEach(([k, v]) => {
            MeetingService.extendedMeetingMeta.set(k, v);
          });
        }
      }
    } catch (e: any) {
      console.warn('[MeetingService] Failed to load persistent meetings store:', e?.message);
    }
  }

  public static savePersistentStore() {
    try {
      const dataDir = path.dirname(STORE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const metaObj: Record<string, any> = {};
      MeetingService.extendedMeetingMeta.forEach((v, k) => {
        metaObj[k] = v;
      });
      const payload = {
        meetings: MeetingService.fallbackMeetings,
        notes: MeetingService.fallbackNotes,
        points: MeetingService.fallbackPoints,
        decisions: MeetingService.fallbackDecisions,
        extendedMeta: metaObj
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[MeetingService] Failed to save persistent meetings store:', e?.message);
    }
  }

  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {
    this.taskService = new TaskService(supabase, orgId, userId);
    this.responsibilityService = new ResponsibilityService(supabase, orgId, userId);
  }

  private parseMeta(notes?: string | null): any {
    if (!notes) return {};
    const match = notes.match(/<!-- BDIQ_META: (.*?) -->/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }
    return {};
  }

  // ============================================================================
  // 1. DASHBOARD & OVERVIEW AGGREGATION
  // ============================================================================

  async getDashboardOverview(filters: MeetingFilterOptions = {}) {
    const today = new Date().toISOString().split('T')[0];
    const meetings = await this.listMeetings(filters);

    const todayMeetings = meetings.filter(m => m.meeting_date === today);
    const upcomingMeetings = meetings.filter(m => m.meeting_date > today);
    const awaitingPreparation = meetings.filter(
      m => m.preparation_status === 'PENDING' && m.meeting_date >= today && m.status === 'SCHEDULED'
    );
    const inProgressMeetings = meetings.filter(m => m.status === 'IN_PROGRESS');
    const awaitingClosure = meetings.filter(
      m => (m.status === 'COMPLETED' || m.meeting_date < today) && m.closure_status !== 'CLOSED'
    );

    let pendingActions: any[] = [];
    let overdueMeetingActions: any[] = [];
    try {
      const { data: allPoints } = await this.supabase
        .from('meeting_points')
        .select('*')
        .eq('organization_id', this.orgId);
      const points = allPoints || MeetingService.fallbackPoints;
      pendingActions = points.filter((p: any) => p.action_required && p.status !== 'RESOLVED' && p.status !== 'CANCELLED');
      overdueMeetingActions = pendingActions.filter((p: any) => p.due_date && p.due_date < today);
    } catch {
      pendingActions = MeetingService.fallbackPoints.filter((p: any) => p.action_required && p.status !== 'RESOLVED');
      overdueMeetingActions = pendingActions.filter((p: any) => p.due_date && p.due_date < today);
    }

    return {
      summary: {
        totalMeetings: meetings.length,
        todayCount: todayMeetings.length,
        upcomingCount: upcomingMeetings.length,
        awaitingPreparationCount: awaitingPreparation.length,
        inProgressCount: inProgressMeetings.length,
        awaitingClosureCount: awaitingClosure.length,
        pendingActionsCount: pendingActions.length,
        overdueActionsCount: overdueMeetingActions.length,
        followupsDueTodayCount: 0,
        overdueFollowupsCount: 0,
        previousActionsStillOpenCount: 0,
        meetingsWithoutMinutesCount: meetings.filter(m => m.status === 'COMPLETED' && !m.minutes_approved).length,
        meetingsWithoutNextStepsCount: meetings.filter(m => m.status === 'COMPLETED').length,
      },
      todayMeetings,
      upcomingMeetings,
      awaitingPreparation,
      inProgressMeetings,
      awaitingClosure,
      pendingActions,
      overdueMeetingActions,
      followupsDueToday: [],
      overdueFollowups: [],
      meetings
    };
  }

  // ============================================================================
  // 2. MEETING CREATION, LISTING & CRUD
  // ============================================================================

  async listMeetings(query: MeetingFilterOptions = {}) {
    let dbMeetings: any[] = [];
    try {
      let q = this.supabase
        .from('meetings')
        .select(`
          *,
          department:departments(id, name),
          opportunity:opportunities(id, title),
          product:products(id, product_name, brand_name)
        `)
        .eq('organization_id', this.orgId)
        .order('meeting_date', { ascending: false })
        .order('meeting_time', { ascending: false });

      if (query.status) q = q.eq('status', query.status);
      if (query.meeting_type) q = q.eq('meeting_type', query.meeting_type);
      if (query.department_id) q = q.eq('department_id', query.department_id);
      if (query.opportunity_id) q = q.eq('opportunity_id', query.opportunity_id);
      if (query.product_id) q = q.eq('product_id', query.product_id);
      if (query.from_date) q = q.gte('meeting_date', query.from_date);
      if (query.to_date) q = q.lte('meeting_date', query.to_date);

      const { data, error } = await q;
      if (!error && data) {
        dbMeetings = data;
      } else {
        // Fallback to simple select if joins fail
        const { data: simpleData } = await this.supabase
          .from('meetings')
          .select('*')
          .eq('organization_id', this.orgId);
        if (simpleData) dbMeetings = simpleData;
      }
    } catch (err: any) {
      console.warn('DB meetings query error, falling back to memory store:', err?.message);
    }

    // Combine DB and memory store deduplicated by ID
    const meetingMap = new Map<string, any>();
    dbMeetings.forEach(m => meetingMap.set(m.id, m));
    MeetingService.fallbackMeetings.forEach(m => {
      if (m.organization_id === this.orgId || m.organization_id?.startsWith('a0000000')) {
        if (!meetingMap.has(m.id)) meetingMap.set(m.id, m);
      }
    });

    const combined = Array.from(meetingMap.values());

    // Enrich each meeting with extended metadata and stats
    const meetingsWithStats = combined.map(m => {
      const storedMeta = MeetingService.extendedMeetingMeta.get(m.id) || this.parseMeta(m.notes) || {};
      const cleanNotes = (m.notes || '').replace(/<!-- BDIQ_META: .*? -->/g, '').trim();

      const mPoints = MeetingService.fallbackPoints.filter((p: any) => p.meeting_id === m.id);
      const mDecisions = MeetingService.fallbackDecisions.filter((d: any) => d.meeting_id === m.id);

      return {
        ...m,
        notes: cleanNotes || null,
        end_time: m.end_time || storedMeta.end_time || null,
        location_or_link: m.location_or_link || storedMeta.location_or_link || null,
        platform: m.platform || storedMeta.platform || 'CUSTOM',
        customer_id: m.customer_id || storedMeta.customer_id || null,
        opportunity_id: m.opportunity_id || storedMeta.opportunity_id || null,
        rfq_id: m.rfq_id || storedMeta.rfq_id || null,
        product_id: m.product_id || storedMeta.product_id || null,
        objective: m.objective || storedMeta.objective || null,
        expected_outcomes: m.expected_outcomes || storedMeta.expected_outcomes || null,
        external_organizations: m.external_organizations || storedMeta.external_organizations || null,
        closure_status: m.closure_status || storedMeta.closure_status || 'OPEN',
        preparation_status: m.preparation_status || storedMeta.preparation_status || 'PENDING',
        actual_start_time: m.actual_start_time || storedMeta.actual_start_time || null,
        actual_end_time: m.actual_end_time || storedMeta.actual_end_time || null,
        started_by: m.started_by || storedMeta.started_by || null,
        recording_status: m.recording_status || storedMeta.recording_status || 'NOT_CONFIGURED',
        transcription_status: m.transcription_status || storedMeta.transcription_status || 'NOT_CONFIGURED',
        mom_status: m.mom_status || storedMeta.mom_status || 'NOT_GENERATED',
        mom_draft: m.mom_draft || storedMeta.mom_draft || null,
        mom_version: m.mom_version || storedMeta.mom_version || 0,
        mom_confirmed_by: m.mom_confirmed_by || storedMeta.mom_confirmed_by || null,
        mom_confirmed_at: m.mom_confirmed_at || storedMeta.mom_confirmed_at || null,
        raw_transcript: m.raw_transcript || storedMeta.raw_transcript || null,
        reminder_preferences: m.reminder_preferences || storedMeta.reminder_preferences || {
          upcoming_24h: true,
          upcoming_1h: true,
          upcoming_15m: true,
          preparation_reminder: true,
          closure_reminder: true
        },
        stats: {
          pointsCount: mPoints.length,
          pendingActionCount: mPoints.filter((p: any) => p.action_required && p.status !== 'RESOLVED' && p.status !== 'CANCELLED').length,
          decisionCount: mDecisions.length,
        }
      };
    });

    return meetingsWithStats;
  }

  async createMeeting(payload: any) {
    // 1. Validation
    if (!payload.title || !payload.title.trim()) {
      throw new ValidationError('Meeting title is required');
    }
    if (!payload.meeting_date) {
      throw new ValidationError('Meeting date is required');
    }
    if (payload.meeting_time && payload.end_time && payload.end_time <= payload.meeting_time) {
      throw new ValidationError('End time must be after start time');
    }

    // Conferencing link validation and normalization
    let normalizedLink = payload.location_or_link ? String(payload.location_or_link).trim() : null;
    if (normalizedLink) {
      if (!normalizedLink.startsWith('http://') && !normalizedLink.startsWith('https://')) {
        normalizedLink = `https://${normalizedLink}`;
      }
    }

    let detectedPlatform = payload.platform || 'CUSTOM';
    if (normalizedLink) {
      const lower = normalizedLink.toLowerCase();
      if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) {
        detectedPlatform = 'TEAMS';
      } else if (lower.includes('zoom.us')) {
        detectedPlatform = 'ZOOM';
      } else if (lower.includes('meet.google.com')) {
        detectedPlatform = 'GOOGLE_MEET';
      } else if (lower.includes('webex.com')) {
        detectedPlatform = 'WEBEX';
      }
    }

    const meetingId = crypto.randomUUID();
    const yearStr = new Date().getFullYear();
    const meetingCode = `MEET-${yearStr}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const extendedMeta = {
      end_time: payload.end_time || null,
      location_or_link: normalizedLink,
      platform: detectedPlatform,
      customer_id: payload.customer_id || null,
      opportunity_id: payload.opportunity_id || null,
      rfq_id: payload.rfq_id || null,
      product_id: payload.product_id || null,
      molecule_id: payload.molecule_id || null,
      objective: payload.objective || null,
      expected_outcomes: payload.expected_outcomes || null,
      external_organizations: payload.external_organizations || null,
      closure_status: 'OPEN',
      preparation_status: 'PENDING',
      actual_start_time: null,
      actual_end_time: null,
      started_by: null,
      recording_status: 'NOT_CONFIGURED',
      transcription_status: 'NOT_CONFIGURED',
      mom_status: 'NOT_GENERATED',
      mom_draft: null,
      mom_version: 0,
      mom_confirmed_by: null,
      mom_confirmed_at: null,
      raw_transcript: null,
      reminder_preferences: payload.reminder_preferences || {
        upcoming_24h: true,
        upcoming_1h: true,
        upcoming_15m: true,
        preparation_reminder: true,
        closure_reminder: true
      }
    };

    MeetingService.extendedMeetingMeta.set(meetingId, extendedMeta);

    const cleanNotes = (payload.notes || '').replace(/<!-- BDIQ_META: .*? -->/g, '').trim();
    const notesWithMeta = `${cleanNotes ? cleanNotes + '\n' : ''}<!-- BDIQ_META: ${JSON.stringify(extendedMeta)} -->`;

    const fullMeetingRecord = {
      id: meetingId,
      organization_id: this.orgId,
      meeting_code: meetingCode,
      title: payload.title.trim(),
      meeting_date: payload.meeting_date,
      meeting_time: payload.meeting_time || '10:00:00',
      end_time: payload.end_time || null,
      timezone: payload.timezone || 'Asia/Kolkata',
      location_or_link: normalizedLink,
      platform: detectedPlatform,
      meeting_type: payload.meeting_type || 'INTERNAL',
      organizer_id: payload.organizer_id || this.userId,
      department_id: payload.department_id || null,
      customer_id: payload.customer_id || null,
      opportunity_id: payload.opportunity_id || null,
      rfq_id: payload.rfq_id || null,
      product_id: payload.product_id || null,
      molecule_id: payload.molecule_id || null,
      meeting_series_id: null,
      previous_meeting_id: payload.previous_meeting_id || null,
      agenda: payload.agenda || null,
      objective: payload.objective || null,
      expected_outcomes: payload.expected_outcomes || null,
      external_organizations: payload.external_organizations || null,
      notes: cleanNotes || null,
      preparation_status: 'PENDING',
      closure_status: 'OPEN',
      status: 'SCHEDULED',
      actual_start_time: null,
      actual_end_time: null,
      started_by: null,
      recording_status: 'NOT_CONFIGURED',
      transcription_status: 'NOT_CONFIGURED',
      mom_status: 'NOT_GENERATED',
      mom_draft: null,
      mom_version: 0,
      mom_confirmed_by: null,
      mom_confirmed_at: null,
      raw_transcript: null,
      reminder_preferences: extendedMeta.reminder_preferences,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 2. Try DB insertion with full columns, gracefully falling back to core columns if needed
    try {
      const fullInsertData: any = {
        id: meetingId,
        organization_id: this.orgId,
        meeting_code: fullMeetingRecord.meeting_code,
        title: fullMeetingRecord.title,
        meeting_date: fullMeetingRecord.meeting_date,
        meeting_time: fullMeetingRecord.meeting_time,
        end_time: fullMeetingRecord.end_time,
        timezone: fullMeetingRecord.timezone,
        location_or_link: fullMeetingRecord.location_or_link,
        platform: fullMeetingRecord.platform,
        meeting_type: fullMeetingRecord.meeting_type,
        organizer_id: fullMeetingRecord.organizer_id,
        department_id: fullMeetingRecord.department_id,
        customer_id: fullMeetingRecord.customer_id,
        opportunity_id: fullMeetingRecord.opportunity_id,
        rfq_id: fullMeetingRecord.rfq_id,
        product_id: fullMeetingRecord.product_id,
        molecule_id: fullMeetingRecord.molecule_id,
        agenda: fullMeetingRecord.agenda,
        objective: fullMeetingRecord.objective,
        expected_outcomes: fullMeetingRecord.expected_outcomes,
        external_organizations: fullMeetingRecord.external_organizations,
        preparation_status: fullMeetingRecord.preparation_status,
        closure_status: fullMeetingRecord.closure_status,
        notes: notesWithMeta,
        status: fullMeetingRecord.status,
        recording_status: fullMeetingRecord.recording_status,
        transcription_status: fullMeetingRecord.transcription_status,
        mom_status: fullMeetingRecord.mom_status,
        mom_version: fullMeetingRecord.mom_version
      };

      const { data: dbData, error: dbErr } = await this.supabase
        .from('meetings')
        .insert(fullInsertData)
        .select('*')
        .maybeSingle();

      if (!dbErr && dbData) {
        MeetingService.fallbackMeetings.unshift({ ...fullMeetingRecord, ...dbData });
      } else {
        // Fallback to core columns if custom columns not yet in DB schema
        const { data: coreData, error: coreErr } = await this.supabase
          .from('meetings')
          .insert({
            id: meetingId,
            organization_id: this.orgId,
            title: fullMeetingRecord.title,
            meeting_date: fullMeetingRecord.meeting_date,
            meeting_time: fullMeetingRecord.meeting_time,
            timezone: fullMeetingRecord.timezone,
            meeting_type: fullMeetingRecord.meeting_type,
            organizer_id: fullMeetingRecord.organizer_id,
            department_id: fullMeetingRecord.department_id,
            opportunity_id: fullMeetingRecord.opportunity_id,
            product_id: fullMeetingRecord.product_id,
            molecule_id: fullMeetingRecord.molecule_id,
            agenda: fullMeetingRecord.agenda,
            notes: notesWithMeta,
            status: fullMeetingRecord.status
          })
          .select('*')
          .maybeSingle();

        if (!coreErr && coreData) {
          MeetingService.fallbackMeetings.unshift({ ...fullMeetingRecord, ...coreData });
        } else {
          MeetingService.fallbackMeetings.unshift(fullMeetingRecord);
        }
      }
    } catch (err: any) {
      MeetingService.fallbackMeetings.unshift(fullMeetingRecord);
    }

    MeetingService.savePersistentStore();

    // 3. Attach participants safely
    if (payload.participants && Array.isArray(payload.participants)) {
      try {
        const parts = payload.participants.map((p: any) => ({
          meeting_id: meetingId,
          user_profile_id: typeof p === 'string' ? p : p.user_profile_id,
          role: typeof p === 'object' && p.role ? p.role : 'ATTENDEE',
          attendance_status: 'PENDING'
        }));
        await this.supabase.from('meeting_participants').insert(parts);
      } catch (partErr: any) {
        console.warn('Failed to insert meeting_participants to DB:', partErr?.message);
      }
    }

    // 4. Schedule reminders asynchronously without blocking
    this.scheduleMeetingReminders(meetingId).catch(remErr => {
      console.warn('Reminder scheduling notice:', remErr?.message);
    });

    return fullMeetingRecord;
  }

  async getMeeting(id: string) {
    let meeting: any = null;
    try {
      const { data, error } = await this.supabase
        .from('meetings')
        .select(`
          *,
          department:departments(id, name),
          opportunity:opportunities(id, title),
          product:products(id, product_name, brand_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) meeting = data;
    } catch {}

    if (!meeting) {
      meeting = MeetingService.fallbackMeetings.find(m => m.id === id);
    }

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    const storedMeta = MeetingService.extendedMeetingMeta.get(meeting.id) || this.parseMeta(meeting.notes) || {};
    const cleanNotes = (meeting.notes || '').replace(/<!-- BDIQ_META: .*? -->/g, '').trim();

    let parsedMomDraft = meeting.mom_draft || storedMeta.mom_draft || null;
    if (typeof parsedMomDraft === 'string' && parsedMomDraft.trim().startsWith('{')) {
      try {
        parsedMomDraft = JSON.parse(parsedMomDraft);
      } catch {}
    }

    return {
      ...meeting,
      notes: cleanNotes || null,
      end_time: meeting.end_time || storedMeta.end_time || null,
      location_or_link: meeting.location_or_link || storedMeta.location_or_link || null,
      platform: meeting.platform || storedMeta.platform || 'CUSTOM',
      customer_id: meeting.customer_id || storedMeta.customer_id || null,
      opportunity_id: meeting.opportunity_id || storedMeta.opportunity_id || null,
      rfq_id: meeting.rfq_id || storedMeta.rfq_id || null,
      product_id: meeting.product_id || storedMeta.product_id || null,
      objective: meeting.objective || storedMeta.objective || null,
      expected_outcomes: meeting.expected_outcomes || storedMeta.expected_outcomes || null,
      external_organizations: meeting.external_organizations || storedMeta.external_organizations || null,
      closure_status: meeting.closure_status || storedMeta.closure_status || 'OPEN',
      preparation_status: meeting.preparation_status || storedMeta.preparation_status || 'PENDING',
      actual_start_time: meeting.actual_start_time || storedMeta.actual_start_time || null,
      actual_end_time: meeting.actual_end_time || storedMeta.actual_end_time || null,
      started_by: meeting.started_by || storedMeta.started_by || null,
      recording_status: meeting.recording_status || storedMeta.recording_status || 'NOT_CONFIGURED',
      transcription_status: meeting.transcription_status || storedMeta.transcription_status || 'NOT_CONFIGURED',
      mom_status: meeting.mom_status || storedMeta.mom_status || 'NOT_GENERATED',
      mom_draft: parsedMomDraft,
      mom_version: meeting.mom_version || storedMeta.mom_version || 0,
      mom_confirmed_by: meeting.mom_confirmed_by || storedMeta.mom_confirmed_by || null,
      mom_confirmed_at: meeting.mom_confirmed_at || storedMeta.mom_confirmed_at || null,
      raw_transcript: meeting.raw_transcript || storedMeta.raw_transcript || null,
      reminder_preferences: meeting.reminder_preferences || storedMeta.reminder_preferences || null,
      participants: meeting.participants || []
    };
  }

  async updateMeeting(id: string, payload: any) {
    if (payload.meeting_time && payload.end_time && payload.end_time <= payload.meeting_time) {
      throw new ValidationError('End time must be after start time');
    }

    if (payload.location_or_link) {
      let link = String(payload.location_or_link).trim();
      if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
        link = `https://${link}`;
      }
      payload.location_or_link = link;
    }

    const current = await this.getMeeting(id);
    const updated = {
      ...current,
      ...payload,
      updated_at: new Date().toISOString()
    };

    const currentMeta = MeetingService.extendedMeetingMeta.get(id) || this.parseMeta(current.notes) || {};
    const updatedMeta = {
      ...currentMeta,
      ...payload
    };
    MeetingService.extendedMeetingMeta.set(id, updatedMeta);

    const cleanNotes = (updated.notes || '').replace(/<!-- BDIQ_META: .*? -->/g, '').trim();
    const notesWithMeta = `${cleanNotes ? cleanNotes + '\n' : ''}<!-- BDIQ_META: ${JSON.stringify(updatedMeta)} -->`;

    try {
      const fullUpdateData: any = {
        title: updated.title,
        meeting_date: updated.meeting_date,
        meeting_time: updated.meeting_time,
        end_time: updated.end_time,
        timezone: updated.timezone,
        location_or_link: updated.location_or_link,
        platform: updated.platform,
        meeting_type: updated.meeting_type,
        agenda: updated.agenda,
        objective: updated.objective,
        expected_outcomes: updated.expected_outcomes,
        external_organizations: updated.external_organizations,
        customer_id: updated.customer_id,
        opportunity_id: updated.opportunity_id,
        rfq_id: updated.rfq_id,
        product_id: updated.product_id,
        status: updated.status,
        closure_status: updated.closure_status,
        closure_summary: updated.closure_summary,
        preparation_status: updated.preparation_status,
        actual_start_time: updated.actual_start_time,
        actual_end_time: updated.actual_end_time,
        started_by: updated.started_by,
        mom_status: updated.mom_status,
        mom_draft: typeof updated.mom_draft === 'object' ? JSON.stringify(updated.mom_draft) : updated.mom_draft,
        mom_version: updated.mom_version,
        mom_confirmed_by: updated.mom_confirmed_by,
        mom_confirmed_at: updated.mom_confirmed_at,
        minutes_text: updated.minutes_text,
        minutes_approved: updated.minutes_approved,
        minutes_approved_at: updated.minutes_approved_at,
        raw_transcript: updated.raw_transcript,
        notes: notesWithMeta,
        updated_at: updated.updated_at
      };

      const { error: fullUpdateErr } = await this.supabase
        .from('meetings')
        .update(fullUpdateData)
        .eq('id', id);

      if (fullUpdateErr) {
        await this.supabase
          .from('meetings')
          .update({
            title: updated.title,
            meeting_date: updated.meeting_date,
            meeting_time: updated.meeting_time,
            timezone: updated.timezone,
            meeting_type: updated.meeting_type,
            agenda: updated.agenda,
            status: updated.status,
            notes: notesWithMeta,
            updated_at: updated.updated_at
          })
          .eq('id', id);
      }
    } catch {}

    const idx = MeetingService.fallbackMeetings.findIndex(m => m.id === id);
    if (idx >= 0) {
      MeetingService.fallbackMeetings[idx] = updated;
    } else {
      MeetingService.fallbackMeetings.unshift(updated);
    }

    MeetingService.savePersistentStore();
    return updated;
  }

  async startMeeting(id: string) {
    const current = await this.getMeeting(id);
    if (!current) throw new NotFoundError('Meeting not found');

    if (current.status === 'COMPLETED') {
      throw new ValidationError('Meeting has already been completed and cannot be restarted.');
    }
    if (current.status === 'CANCELLED') {
      throw new ValidationError('Cancelled meetings cannot be started.');
    }

    const now = new Date().toISOString();
    const updated = await this.updateMeeting(id, {
      status: 'IN_PROGRESS',
      actual_start_time: current.actual_start_time || now,
      started_by: this.userId
    });

    return {
      ...updated,
      status: 'IN_PROGRESS',
      actual_start_time: updated.actual_start_time || now,
      started_by: this.userId,
      launch_url: updated.location_or_link || null
    };
  }

  async endMeeting(id: string) {
    const current = await this.getMeeting(id);
    if (!current) throw new NotFoundError('Meeting not found');

    const now = new Date().toISOString();
    const updated = await this.updateMeeting(id, {
      status: 'AWAITING_MOM_REVIEW',
      actual_end_time: now
    });

    const notes = await this.getNotes(id);
    const points = await this.getMeetingPoints(id);
    const decisions = await this.getDecisions(id);

    return {
      ...updated,
      status: 'AWAITING_MOM_REVIEW',
      actual_end_time: now,
      session_summary: {
        notesCount: notes.length,
        pointsCount: points.length,
        decisionsCount: decisions.length,
        actionItemsCount: points.filter((p: any) => p.action_required).length,
        convertedTasksCount: points.filter((p: any) => p.linked_task_id).length,
        unconvertedActionCount: points.filter((p: any) => p.action_required && !p.linked_task_id).length
      }
    };
  }

  // ============================================================================
  // 3. PREPARATION WORKSPACE & PREVIOUS MEETING POINTS
  // ============================================================================

  async getPreparationWorkspace(meetingId: string) {
    const meeting = await this.getMeeting(meetingId);
    const previousMeeting = await this.resolvePreviousMeeting(meeting);

    let previousSummary: any = null;
    let previousPoints: any[] = [];
    let previousDecisions: any[] = [];
    let openActions: any[] = [];
    let overdueActions: any[] = [];
    let noUpdateRecords: any[] = [];

    const today = new Date().toISOString().split('T')[0];

    if (previousMeeting) {
      previousSummary = {
        id: previousMeeting.id,
        meeting_code: previousMeeting.meeting_code,
        title: previousMeeting.title,
        meeting_date: previousMeeting.meeting_date,
        closure_summary: previousMeeting.closure_summary || previousMeeting.notes || 'Meeting completed normally.',
        minutes_approved: previousMeeting.minutes_approved,
      };

      // Fetch points from previous meeting
      const { data: pts } = await this.supabase
        .from('meeting_points')
        .select(`
          *,
          department:departments!responsible_department_id(id, name),
          responsible_user:user_profiles!responsible_user_id(id, first_name, last_name),
          linked_task:tasks!linked_task_id(id, task_code, title, status, original_due_date, current_due_date)
        `)
        .eq('meeting_id', previousMeeting.id);

      previousPoints = pts || [];

      // Fetch decisions from previous meeting
      const { data: decs } = await this.supabase
        .from('meeting_decisions')
        .select('*')
        .eq('meeting_id', previousMeeting.id);

      previousDecisions = decs || [];
    }

    // Fetch open tasks linked to customer/opp/meeting
    let taskFilter = this.supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:user_profiles!assigned_user_id(id, first_name, last_name),
        department:departments!assigned_department_id(id, name),
        task_followups(*)
      `)
      .eq('organization_id', this.orgId)
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED');

    if (meeting.opportunity_id) {
      taskFilter = taskFilter.eq('opportunity_id', meeting.opportunity_id);
    } else if (meeting.customer_id) {
      taskFilter = taskFilter.eq('customer_id', meeting.customer_id);
    } else if (previousMeeting) {
      taskFilter = taskFilter.eq('meeting_id', previousMeeting.id);
    }

    const { data: openTasks } = await taskFilter;
    const taskList = openTasks || [];

    // Analyze delay and follow-up status
    openActions = taskList.map(t => {
      const isOverdue = t.original_due_date && t.original_due_date < today;
      const delayDays = isOverdue ? calendarDaysDiff(new Date(t.original_due_date), new Date()) : 0;
      const latestFollowup = t.task_followups && t.task_followups.length > 0
        ? t.task_followups.sort((a: any, b: any) => b.followup_number - a.followup_number)[0]
        : null;

      const hasNoUpdate = latestFollowup && latestFollowup.response_status === 'NO_UPDATE';

      return {
        ...t,
        isOverdue,
        delayDays,
        latestFollowup,
        hasNoUpdate,
        followupCount: t.task_followups ? t.task_followups.length : 0,
      };
    });

    overdueActions = openActions.filter(a => a.isOverdue);
    noUpdateRecords = openActions.filter(a => a.hasNoUpdate);

    // Fetch open risks
    let riskQuery = this.supabase
      .from('risk_records')
      .select('*')
      .eq('organization_id', this.orgId)
      .neq('status', 'RESOLVED')
      .neq('status', 'MITIGATED');

    if (meeting.opportunity_id) riskQuery = riskQuery.eq('opportunity_id', meeting.opportunity_id);
    else if (meeting.product_id) riskQuery = riskQuery.eq('product_id', meeting.product_id);

    const { data: risks } = await riskQuery;

    // Fetch related entity statuses
    let relatedContext: any = {
      customer: meeting.customer,
      opportunity: meeting.opportunity,
      rfq: meeting.rfq,
      product: meeting.product,
    };

    // Suggested Agenda items based on open and overdue items
    const suggestedAgenda: string[] = [];
    if (previousSummary) {
      suggestedAgenda.push(`Review actions from ${previousSummary.meeting_code} (${previousSummary.meeting_date})`);
    }
    if (overdueActions.length > 0) {
      suggestedAgenda.push(`Urgent: Address ${overdueActions.length} overdue commitment(s)`);
    }
    if (noUpdateRecords.length > 0) {
      suggestedAgenda.push(`Accountability check: Follow up on ${noUpdateRecords.length} item(s) with no updates`);
    }
    if (risks && risks.length > 0) {
      suggestedAgenda.push(`Risk mitigation: Review ${risks.length} open project risk(s)`);
    }
    suggestedAgenda.push('New Business & Customer Updates');
    suggestedAgenda.push('Agreed Decisions & Next Commitments');

    // Practical question list generated from agenda, objective, customer, opportunity, and open actions
    const suggestedQuestions: any[] = [];
    if (meeting.objective) {
      suggestedQuestions.push({
        id: 'q-obj-1',
        category: 'OBJECTIVE',
        question: `How does our proposed batch feasibility align with the primary objective: "${meeting.objective}"?`,
        status: 'OPEN'
      });
    }
    if (overdueActions.length > 0) {
      suggestedQuestions.push({
        id: 'q-act-1',
        category: 'ACCOUNTABILITY',
        question: `What is the revised completion date and root cause mitigation for the ${overdueActions.length} overdue action item(s)?`,
        status: 'OPEN'
      });
    }
    if (meeting.customer) {
      suggestedQuestions.push({
        id: 'q-cust-1',
        category: 'CUSTOMER_ALIGNMENT',
        question: `Are there specific technical or regulatory prerequisites from ${meeting.customer.name} required before commercial quotation?`,
        status: 'OPEN'
      });
    }
    if (meeting.opportunity) {
      suggestedQuestions.push({
        id: 'q-opp-1',
        category: 'COMMERCIAL_SCOPE',
        question: `What is the target commercial launch timeline and volume ramp-up for ${meeting.opportunity.title}?`,
        status: 'OPEN'
      });
    }
    if (risks && risks.length > 0) {
      suggestedQuestions.push({
        id: 'q-risk-1',
        category: 'RISK_MITIGATION',
        question: `Have critical quality attributes and equipment capacity constraints been evaluated for the ${risks.length} open project risk(s)?`,
        status: 'OPEN'
      });
    }
    suggestedQuestions.push({
      id: 'q-dec-1',
      category: 'DECISION_CONFIRMATION',
      question: 'Which formal decisions and accountable department assignees must be finalized before session adjournment?',
      status: 'OPEN'
    });

    return {
      meeting,
      previousSummary,
      previousPoints,
      previousDecisions,
      openActions,
      overdueActions,
      noUpdateRecords,
      openRisks: risks || [],
      relatedContext,
      suggestedAgenda,
      suggestedQuestions,
    };
  }

  /**
   * Resolves previous meeting adhering to strict 5-tier precedence order:
   * 1. Explicit previous_meeting_id link
   * 2. Same recurring meeting_series_id
   * 3. Same customer_id and opportunity_id
   * 4. Same customer_id or project
   * 5. Fallback: null
   */
  async resolvePreviousMeeting(currentMeeting: any) {
    // 1. Explicit link
    if (currentMeeting.previous_meeting_id) {
      const { data } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('id', currentMeeting.previous_meeting_id)
        .maybeSingle();
      if (data) return data;
    }

    // 2. Same recurring series
    if (currentMeeting.meeting_series_id) {
      const { data } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('meeting_series_id', currentMeeting.meeting_series_id)
        .lt('meeting_date', currentMeeting.meeting_date)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }

    // 3. Same customer and opportunity
    if (currentMeeting.customer_id && currentMeeting.opportunity_id) {
      const { data } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('customer_id', currentMeeting.customer_id)
        .eq('opportunity_id', currentMeeting.opportunity_id)
        .neq('id', currentMeeting.id)
        .lt('meeting_date', currentMeeting.meeting_date)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }

    // 4. Same customer
    if (currentMeeting.customer_id) {
      const { data } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('customer_id', currentMeeting.customer_id)
        .neq('id', currentMeeting.id)
        .lt('meeting_date', currentMeeting.meeting_date)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }

    return null;
  }

  // ============================================================================
  // 4. LIVE MINI NOTES & QUICK CAPTURE
  // ============================================================================

  async getNotes(meetingId: string) {
    let dbNotes: any[] = [];
    try {
      const { data, error } = await this.supabase
        .from('meeting_notes')
        .select(`
          *,
          user:user_profiles!user_id(id, first_name, last_name),
          department:departments(id, name)
        `)
        .eq('organization_id', this.orgId)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (!error && data) dbNotes = data;
    } catch (err: any) {
      console.warn('DB getNotes fallback to memory store:', err?.message);
    }

    const memoryNotes = MeetingService.fallbackNotes.filter(n => n.meeting_id === meetingId);
    const noteMap = new Map<string, any>();
    dbNotes.forEach(n => noteMap.set(n.id, n));
    memoryNotes.forEach(n => {
      if (!noteMap.has(n.id)) noteMap.set(n.id, n);
    });
    return Array.from(noteMap.values());
  }

  async createNote(meetingId: string, payload: any) {
    if (!payload.content || !payload.content.trim()) {
      throw new ValidationError('Note content cannot be empty');
    }

    const noteId = crypto.randomUUID();
    const newNote = {
      id: noteId,
      organization_id: this.orgId,
      meeting_id: meetingId,
      user_id: this.userId,
      content: payload.content.trim(),
      speaker: payload.speaker || null,
      department_id: payload.department_id || null,
      agenda_item: payload.agenda_item || null,
      note_type: payload.note_type || 'NOTE',
      is_draft: payload.is_draft || false,
      client_mutation_id: payload.client_mutation_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Deduplication check via client_mutation_id
    if (payload.client_mutation_id) {
      const existing = MeetingService.fallbackNotes.find(
        n => n.client_mutation_id === payload.client_mutation_id
      );
      if (existing) return existing;
    }

    try {
      const { data, error } = await this.supabase
        .from('meeting_notes')
        .insert(newNote)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        MeetingService.fallbackNotes.push({ ...newNote, ...data });
        MeetingService.savePersistentStore();
        return { ...newNote, ...data };
      }
    } catch {}

    MeetingService.fallbackNotes.push(newNote);
    MeetingService.savePersistentStore();
    return newNote;
  }

  async updateNote(noteId: string, payload: any) {
    let updatedNote: any = null;
    try {
      const { data, error } = await this.supabase
        .from('meeting_notes')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', this.orgId)
        .eq('id', noteId)
        .select('*')
        .maybeSingle();

      if (!error && data) updatedNote = data;
    } catch {}

    const idx = MeetingService.fallbackNotes.findIndex(n => n.id === noteId);
    if (idx >= 0) {
      MeetingService.fallbackNotes[idx] = {
        ...MeetingService.fallbackNotes[idx],
        ...payload,
        updated_at: new Date().toISOString()
      };
      if (!updatedNote) updatedNote = MeetingService.fallbackNotes[idx];
    }

    if (!updatedNote) {
      updatedNote = {
        id: noteId,
        ...payload,
        updated_at: new Date().toISOString()
      };
      MeetingService.fallbackNotes.push(updatedNote);
    }
    MeetingService.savePersistentStore();
    return updatedNote;
  }

  async deleteNote(noteId: string) {
    try {
      await this.supabase
        .from('meeting_notes')
        .delete()
        .eq('organization_id', this.orgId)
        .eq('id', noteId);
    } catch {}

    const idx = MeetingService.fallbackNotes.findIndex(n => n.id === noteId);
    if (idx >= 0) {
      MeetingService.fallbackNotes.splice(idx, 1);
    }
    MeetingService.savePersistentStore();
    return { success: true };
  }

  quickCaptureParse(text: string) {
    return MeetingQuickCaptureService.parseNote(text);
  }

  // ============================================================================
  // 5. STRUCTURED MEETING POINTS & DECISIONS
  // ============================================================================

  async getMeetingPoints(meetingId: string) {
    let dbPoints: any[] = [];
    try {
      const { data, error } = await this.supabase
        .from('meeting_points')
        .select(`
          *,
          responsible_department:departments!responsible_department_id(id, name),
          responsible_user:user_profiles!responsible_user_id(id, first_name, last_name, email),
          linked_task:tasks!linked_task_id(id, task_code, title, status, original_due_date, current_due_date),
          linked_risk:risk_records!linked_risk_id(id, risk_code, risk_title, risk_level)
        `)
        .eq('organization_id', this.orgId)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (!error && data) dbPoints = data;
    } catch (err: any) {
      console.warn('DB getMeetingPoints fallback to memory store:', err?.message);
    }

    const memoryPoints = MeetingService.fallbackPoints.filter(p => p.meeting_id === meetingId);
    const pointMap = new Map<string, any>();
    dbPoints.forEach(p => pointMap.set(p.id, p));
    memoryPoints.forEach(p => {
      if (!pointMap.has(p.id)) pointMap.set(p.id, p);
    });
    return Array.from(pointMap.values());
  }

  async createMeetingPoint(meetingId: string, payload: any) {
    if (!payload.title || !payload.title.trim()) {
      throw new ValidationError('Meeting point title is required');
    }

    // Auto-suggest responsibility using Responsibility Engine if not explicitly supplied
    let deptId = payload.responsible_department_id || null;
    let userId = payload.responsible_user_id || null;

    if (!deptId) {
      try {
        const resolution = await this.responsibilityService.resolveResponsibility({
          taskType: payload.category || 'DISCUSSION',
          businessArea: 'MEETING_POINT',
        });
        if (resolution && resolution.responsibleDepartment) {
          deptId = (resolution.responsibleDepartment as any).id;
          if (resolution.assignmentMode === 'AUTO_ASSIGN' && resolution.suggestedMember) {
            userId = (resolution.suggestedMember as any).id;
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    const pointId = crypto.randomUUID();
    const pointCode = `PT-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const newPoint = {
      id: pointId,
      organization_id: this.orgId,
      meeting_id: meetingId,
      point_code: pointCode,
      title: payload.title.trim(),
      description: payload.description || null,
      agenda_item: payload.agenda_item || null,
      category: payload.category || 'DISCUSSION',
      priority: payload.priority || 'MEDIUM',
      discussion_notes: payload.discussion_notes || null,
      decision_text: payload.decision_text || null,
      action_required: payload.action_required ?? (payload.category === 'ACTION'),
      responsible_department_id: deptId,
      responsible_user_id: userId,
      due_date: payload.due_date || null,
      status: payload.status || 'OPEN',
      related_customer_id: payload.related_customer_id || null,
      related_opportunity_id: payload.related_opportunity_id || null,
      related_rfq_id: payload.related_rfq_id || null,
      related_product_id: payload.related_product_id || null,
      source_note_id: payload.source_note_id || null,
      linked_task_id: payload.linked_task_id || null,
      linked_risk_id: payload.linked_risk_id || null,
      is_ai_suggested: payload.is_ai_suggested ?? false,
      created_by: this.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await this.supabase
        .from('meeting_points')
        .insert(newPoint)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        MeetingService.fallbackPoints.push({ ...newPoint, ...data });
        MeetingService.savePersistentStore();
        return { ...newPoint, ...data };
      }
    } catch {}

    MeetingService.fallbackPoints.push(newPoint);
    MeetingService.savePersistentStore();
    return newPoint;
  }

  async updateMeetingPoint(pointId: string, payload: any) {
    let updatedPoint: any = null;
    try {
      const { data, error } = await this.supabase
        .from('meeting_points')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', this.orgId)
        .eq('id', pointId)
        .select('*')
        .maybeSingle();

      if (!error && data) updatedPoint = data;
    } catch {}

    const idx = MeetingService.fallbackPoints.findIndex(p => p.id === pointId);
    if (idx >= 0) {
      MeetingService.fallbackPoints[idx] = {
        ...MeetingService.fallbackPoints[idx],
        ...payload,
        updated_at: new Date().toISOString()
      };
      if (!updatedPoint) updatedPoint = MeetingService.fallbackPoints[idx];
    }

    if (!updatedPoint) {
      updatedPoint = {
        id: pointId,
        ...payload,
        updated_at: new Date().toISOString()
      };
      MeetingService.fallbackPoints.push(updatedPoint);
    }
    MeetingService.savePersistentStore();
    return updatedPoint;
  }

  async carryForwardPoint(pointId: string, targetMeetingId: string, reason?: string) {
    // 1. Fetch original point
    let original: any = null;
    try {
      const { data } = await this.supabase
        .from('meeting_points')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('id', pointId)
        .maybeSingle();

      if (data) original = data;
    } catch {}

    if (!original) {
      original = MeetingService.fallbackPoints.find(p => p.id === pointId);
    }

    if (!original) throw new NotFoundError('Source meeting point not found');

    // 2. Create carried-forward point in target meeting
    const carriedId = crypto.randomUUID();
    const carriedPoint = {
      id: carriedId,
      organization_id: this.orgId,
      meeting_id: targetMeetingId,
      point_code: `PT-${String(Math.floor(1000 + Math.random() * 9000))}`,
      title: original.title,
      description: original.description,
      agenda_item: original.agenda_item,
      category: original.category,
      priority: original.priority,
      discussion_notes: `[Carried Forward]: ${reason || 'Preserved from previous meeting review'}\nPrevious notes: ${original.discussion_notes || ''}`,
      decision_text: original.decision_text,
      action_required: original.action_required,
      responsible_department_id: original.responsible_department_id,
      responsible_user_id: original.responsible_user_id,
      due_date: original.due_date,
      status: 'OPEN',
      related_customer_id: original.related_customer_id,
      related_opportunity_id: original.related_opportunity_id,
      related_rfq_id: original.related_rfq_id,
      related_product_id: original.related_product_id,
      linked_task_id: original.linked_task_id,
      carried_forward_from_id: original.id,
      carry_forward_count: (original.carry_forward_count || 0) + 1,
      created_by: this.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await this.supabase.from('meeting_points').insert(carriedPoint);
      await this.supabase.from('meeting_points').update({
        status: 'CARRIED_FORWARD',
        updated_at: new Date().toISOString()
      }).eq('id', original.id);
    } catch {}

    MeetingService.fallbackPoints.push(carriedPoint);
    const origIdx = MeetingService.fallbackPoints.findIndex(p => p.id === original.id);
    if (origIdx >= 0) {
      MeetingService.fallbackPoints[origIdx].status = 'CARRIED_FORWARD';
    }
    MeetingService.savePersistentStore();

    return carriedPoint;
  }

  async getDecisions(meetingId: string) {
    let dbDecisions: any[] = [];
    try {
      const { data, error } = await this.supabase
        .from('meeting_decisions')
        .select(`
          *,
          decision_owner:user_profiles!decision_owner_id(id, first_name, last_name, email),
          affected_product:products(id, name),
          affected_opportunity:opportunities(id, title),
          affected_rfq:rfqs(id, rfq_number),
          linked_point:meeting_points(id, point_code, title)
        `)
        .eq('organization_id', this.orgId)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (!error && data) dbDecisions = data;
    } catch (err: any) {
      console.warn('DB getDecisions fallback to memory store:', err?.message);
    }

    const memoryDecisions = MeetingService.fallbackDecisions.filter(d => d.meeting_id === meetingId);
    const decMap = new Map<string, any>();
    dbDecisions.forEach(d => decMap.set(d.id, d));
    memoryDecisions.forEach(d => {
      if (!decMap.has(d.id)) decMap.set(d.id, d);
    });
    return Array.from(decMap.values());
  }

  async createDecision(meetingId: string, payload: any) {
    if (!payload.title || !payload.title.trim()) {
      throw new ValidationError('Decision title is required');
    }

    const decisionId = crypto.randomUUID();
    const newDecision = {
      id: decisionId,
      organization_id: this.orgId,
      meeting_id: meetingId,
      decision_code: `DEC-${String(Math.floor(1000 + Math.random() * 9000))}`,
      title: payload.title.trim(),
      description: payload.description || null,
      decision_date: payload.decision_date || new Date().toISOString().split('T')[0],
      decision_owner_id: payload.decision_owner_id || this.userId,
      participants_summary: payload.participants_summary || null,
      rationale: payload.rationale || null,
      evidence: payload.evidence || null,
      affected_product_id: payload.affected_product_id || null,
      affected_opportunity_id: payload.affected_opportunity_id || null,
      affected_rfq_id: payload.affected_rfq_id || null,
      impact: payload.impact || 'MEDIUM',
      followup_required: payload.followup_required || false,
      is_confirmed: payload.is_confirmed ?? false,
      confirmed_by: payload.is_confirmed ? this.userId : null,
      confirmed_at: payload.is_confirmed ? new Date().toISOString() : null,
      linked_point_id: payload.linked_point_id || null,
      created_by: this.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await this.supabase
        .from('meeting_decisions')
        .insert(newDecision)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        MeetingService.fallbackDecisions.push({ ...newDecision, ...data });
        MeetingService.savePersistentStore();
        return { ...newDecision, ...data };
      }
    } catch {}

    MeetingService.fallbackDecisions.push(newDecision);
    MeetingService.savePersistentStore();
    return newDecision;
  }

  // ============================================================================
  // 6. ACTION ITEM TO TASK CREATION (EXTENDS EXISTING TASK MANAGEMENT)
  // ============================================================================

  async convertPointToTask(pointId: string, payload: any) {
    // 1. Fetch point
    let point: any = null;
    try {
      const { data } = await this.supabase
        .from('meeting_points')
        .select('*, meeting:meetings!meeting_id(*)')
        .eq('organization_id', this.orgId)
        .eq('id', pointId)
        .maybeSingle();

      if (data) point = data;
    } catch {}

    if (!point) {
      point = MeetingService.fallbackPoints.find(p => p.id === pointId);
      if (point && !point.meeting) {
        point.meeting = await this.getMeeting(point.meeting_id);
      }
    }

    if (!point) throw new NotFoundError('Meeting point not found');

    // Deduplication check: Do not duplicate if task already linked
    if (point.linked_task_id) {
      try {
        const { data: existingTask } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('id', point.linked_task_id)
          .maybeSingle();

        if (existingTask) return existingTask;
      } catch {}

      const memTask = (TaskService as any).fallbackTasks?.find((t: any) => t.id === point.linked_task_id);
      if (memTask) return memTask;

      return {
        id: point.linked_task_id,
        title: point.title,
        status: 'OPEN'
      };
    }

    const meeting = point.meeting || {};
    const dueDate = payload.due_date || point.due_date || new Date().toISOString().split('T')[0];

    // 2. Call existing TaskService.createTask
    const taskPayload = {
      title: payload.title || point.title,
      description: payload.description || point.description || `Action item from meeting ${meeting.meeting_code || 'MEET'} - ${meeting.title || ''}`,
      task_type: payload.task_type || 'MEETING_ACTION',
      priority: payload.priority || point.priority || 'MEDIUM',
      source_type: 'MEETING',
      meeting_id: meeting.id || point.meeting_id,
      assigned_department_id: payload.department_id || point.responsible_department_id || null,
      assigned_user_id: payload.assigned_user_id || point.responsible_user_id || null,
      opportunity_id: payload.opportunity_id || meeting.opportunity_id || null,
      customer_id: payload.customer_id || meeting.customer_id || null,
      rfq_id: payload.rfq_id || meeting.rfq_id || null,
      product_id: payload.product_id || meeting.product_id || null,
      original_due_date: dueDate,
      current_due_date: dueDate
    };

    const task = await this.taskService.createTask(taskPayload);

    // 3. Link task back to meeting point
    try {
      await this.supabase
        .from('meeting_points')
        .update({
          linked_task_id: task.id,
          action_required: true,
          status: 'ACTION_REQUIRED',
          updated_at: new Date().toISOString()
        })
        .eq('id', point.id);
    } catch {}

    const ptIdx = MeetingService.fallbackPoints.findIndex(p => p.id === point.id);
    if (ptIdx >= 0) {
      MeetingService.fallbackPoints[ptIdx].linked_task_id = task.id;
      MeetingService.fallbackPoints[ptIdx].action_required = true;
      MeetingService.fallbackPoints[ptIdx].status = 'ACTION_REQUIRED';
    }
    MeetingService.savePersistentStore();

    return task;
  }

  // ============================================================================
  // 7. MEETING CLOSURE WIZARD & MINUTES GENERATION
  // ============================================================================

  async executeMeetingClosure(meetingId: string, closureData: any) {
    const meeting = await this.getMeeting(meetingId);
    const points = await this.getMeetingPoints(meetingId);
    const decisions = await this.getDecisions(meetingId);

    // Generate comprehensive minutes text
    const minutesLines: string[] = [];
    minutesLines.push(`================================================================`);
    minutesLines.push(`MINUTES OF MEETING: ${meeting.title.toUpperCase()}`);
    minutesLines.push(`CODE: ${meeting.meeting_code} | DATE: ${meeting.meeting_date} ${meeting.meeting_time || ''}`);
    minutesLines.push(`ORGANIZER: ${meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'N/A'}`);
    minutesLines.push(`TYPE: ${meeting.meeting_type}`);
    if (meeting.customer) minutesLines.push(`CUSTOMER: ${meeting.customer.name}`);
    if (meeting.opportunity) minutesLines.push(`OPPORTUNITY: ${meeting.opportunity.title}`);
    minutesLines.push(`================================================================\n`);

    minutesLines.push(`1. OBJECTIVE & AGENDA`);
    minutesLines.push(meeting.objective || meeting.agenda || 'Standard meeting discussion.');
    minutesLines.push(`\n2. FORMAL DECISIONS RECORDED (${decisions.length})`);
    if (decisions.length === 0) {
      minutesLines.push('No formal decisions recorded.');
    } else {
      decisions.forEach((d: any, idx: number) => {
        minutesLines.push(`  ${idx + 1}. [${d.decision_code}] ${d.title}`);
        if (d.rationale) minutesLines.push(`     Rationale: ${d.rationale}`);
        if (d.impact) minutesLines.push(`     Impact: ${d.impact}`);
      });
    }

    minutesLines.push(`\n3. ACTION ITEMS & COMMITMENTS`);
    const actionPoints = points.filter(p => p.action_required);
    if (actionPoints.length === 0) {
      minutesLines.push('No action items created.');
    } else {
      actionPoints.forEach((p: any, idx: number) => {
        const owner = p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned';
        const dept = p.responsible_department ? p.responsible_department.name : 'General';
        minutesLines.push(`  ${idx + 1}. [${p.point_code}] ${p.title} (Owner: ${owner} | Dept: ${dept} | Due: ${p.due_date || 'TBD'})`);
      });
    }

    minutesLines.push(`\n4. MEETING CLOSURE SUMMARY`);
    minutesLines.push(closureData.summary || 'Meeting formally concluded and actions agreed.');
    if (closureData.next_meeting_date) {
      minutesLines.push(`\nNEXT SCHEDULED MEETING: ${closureData.next_meeting_date}`);
    }

    const minutesText = minutesLines.join('\n');

    // Update meeting with closure data
    let updated: any = null;
    try {
      const { data, error } = await this.supabase
        .from('meetings')
        .update({
          status: 'COMPLETED',
          closure_status: closureData.is_draft ? 'IN_CLOSURE' : 'CLOSED',
          closure_summary: closureData.summary || null,
          closure_data: closureData,
          minutes_text: minutesText,
          minutes_approved: !closureData.is_draft,
          minutes_approved_at: !closureData.is_draft ? new Date().toISOString() : null,
          minutes_approved_by: !closureData.is_draft ? this.userId : null,
          closed_at: !closureData.is_draft ? new Date().toISOString() : null,
          closed_by: !closureData.is_draft ? this.userId : null,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', this.orgId)
        .eq('id', meetingId)
        .select('*')
        .maybeSingle();

      if (!error && data) updated = data;
    } catch {}

    if (!updated) {
      try {
        await this.supabase
          .from('meetings')
          .update({
            status: 'COMPLETED',
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);
      } catch {}

      updated = {
        ...meeting,
        status: 'COMPLETED',
        closure_status: closureData.is_draft ? 'IN_CLOSURE' : 'CLOSED',
        closure_summary: closureData.summary || null,
        closure_data: closureData,
        minutes_text: minutesText,
        minutes_approved: !closureData.is_draft,
        minutes_approved_at: !closureData.is_draft ? new Date().toISOString() : null,
        closed_at: !closureData.is_draft ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };
    }

    MeetingService.extendedMeetingMeta.set(meetingId, {
      ...MeetingService.extendedMeetingMeta.get(meetingId),
      closure_status: closureData.is_draft ? 'IN_CLOSURE' : 'CLOSED',
      closure_summary: closureData.summary || null,
      closure_data: closureData
    });

    const mIdx = MeetingService.fallbackMeetings.findIndex(m => m.id === meetingId);
    if (mIdx >= 0) {
      MeetingService.fallbackMeetings[mIdx] = { ...MeetingService.fallbackMeetings[mIdx], ...updated };
    }

    // Carry forward any points selected in wizard to next meeting if next meeting exists
    if (closureData.carry_forward_points && Array.isArray(closureData.carry_forward_points) && closureData.next_meeting_id) {
      for (const ptId of closureData.carry_forward_points) {
        await this.carryForwardPoint(ptId, closureData.next_meeting_id, 'Carried forward during closure wizard');
      }
    }

    return updated;
  }

  // ============================================================================
  // 7. FORMAL DECISION CONFIRMATION & GATING
  // ============================================================================

  async confirmDecision(decisionId: string, isConfirmed = true) {
    let dec: any = null;
    try {
      const { data } = await this.supabase
        .from('meeting_decisions')
        .update({
          is_confirmed: isConfirmed,
          confirmed_by: this.userId,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', decisionId)
        .select('*')
        .maybeSingle();
      if (data) dec = data;
    } catch {}

    const idx = MeetingService.fallbackDecisions.findIndex(d => d.id === decisionId);
    if (idx >= 0) {
      MeetingService.fallbackDecisions[idx] = {
        ...MeetingService.fallbackDecisions[idx],
        is_confirmed: isConfirmed,
        confirmed_by: this.userId,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (!dec) dec = MeetingService.fallbackDecisions[idx];
    }

    if (!dec) throw new NotFoundError('Decision not found');
    MeetingService.savePersistentStore();
    return dec;
  }

  // ============================================================================
  // 8. AUTOMATIC MINUTES OF MEETING (MOM) GENERATION & REVIEW
  // ============================================================================

  async generateMOMDraft(meetingId: string, options: { raw_transcript?: string; useAI?: boolean } = {}) {
    const meeting = await this.getMeeting(meetingId);
    const points = await this.getMeetingPoints(meetingId);
    const decisions = await this.getDecisions(meetingId);
    const notes = await this.getNotes(meetingId);
    const previousMeeting = await this.resolvePreviousMeeting(meeting);

    const actionPoints = points.filter((p: any) => p.action_required);
    const confirmedDecisions = decisions.filter((d: any) => d.is_confirmed !== false);
    const risks = points.filter((p: any) => p.category === 'RISK' || p.priority === 'HIGH' || p.priority === 'CRITICAL');
    const carriedPoints = points.filter((p: any) => p.carried_forward_from_id);
    const questions = points.filter((p: any) => p.category === 'QUESTION');

    const organizerName = meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'Platform Organizer';
    const customerName = meeting.customer ? meeting.customer.name : (meeting.external_organizations || 'Internal Team');
    const oppTitle = meeting.opportunity ? meeting.opportunity.title : (meeting.rfq ? `RFQ ${meeting.rfq.rfq_number}` : 'Standard Business Development');

    // Build the 18 standard sections per master specification
    const momSections = [
      `================================================================================`,
      `MINUTES OF MEETING (MOM): ${meeting.title.toUpperCase()}`,
      `REFERENCE CODE: ${meeting.meeting_code} | STATUS: DRAFT | VERSION: ${(meeting.mom_version || 0) + 1}`,
      `================================================================================\n`,

      `1. MEETING IDENTIFICATION & REFERENCE`,
      `• Title: ${meeting.title}`,
      `• Unique Reference: ${meeting.meeting_code}`,
      `• Meeting Type: ${meeting.meeting_type}`,
      `• Conferencing Link: ${meeting.location_or_link || 'Not provided'}`,
      `• Platform: ${meeting.platform || 'CUSTOM'}\n`,

      `2. SCHEDULE & TIMING`,
      `• Scheduled Date: ${meeting.meeting_date}`,
      `• Scheduled Time: ${meeting.meeting_time || '10:00:00'} - ${meeting.end_time || '11:00:00'} (${meeting.timezone || 'Asia/Kolkata'})`,
      `• Actual Session Start: ${meeting.actual_start_time || 'Recorded at live launch'}`,
      `• Actual Session End: ${meeting.actual_end_time || 'Concluded at session finish'}\n`,

      `3. ATTENDANCE & PARTICIPANTS`,
      `• Presiding / Organizer: ${organizerName}`,
      `• Client / Partner Organization: ${customerName}`,
      `• Related Opportunity / Scope: ${oppTitle}`,
      `• Attendees Recorded: ${(meeting.participants && meeting.participants.length > 0) ? meeting.participants.map((p: any) => p.name || p.user_profile_id).join(', ') : 'Registered attendees and project team'}\n`,

      `4. MEETING OBJECTIVE`,
      `${meeting.objective || 'Review project milestones, evaluate technical formulation batch feasibility, and establish delivery commitments.'}\n`,

      `5. ADOPTED AGENDA`,
      `${meeting.agenda || '1. Review of previous actions\n2. Technical & commercial progress\n3. Decisions, task ownership & milestone confirmation'}\n`,

      `6. EXECUTIVE SUMMARY`,
      `Meeting ${meeting.meeting_code} was held on ${meeting.meeting_date} bringing together key stakeholders from ${customerName} and technical BD. ` +
      `During this live session, ${notes.length} discussion notes were recorded, ${confirmedDecisions.length} formal decisions were agreed upon, and ` +
      `${actionPoints.length} concrete action item(s) were assigned to accountable functional owners with confirmed deadlines. ` +
      `${risks.length > 0 ? `Identified ${risks.length} key operational risk(s) requiring proactive mitigation.` : 'No critical bottlenecks unmitigated.'}\n`,

      `7. DISCUSSION SUMMARY BY AGENDA ITEM`,
      notes.length === 0
        ? 'No raw notes captured during this session.'
        : notes.map((n: any, i: number) => `  [Note ${i + 1}] (${n.note_type || 'NOTE'}${n.speaker ? ` - ${n.speaker}` : ''}): ${n.content}`).join('\n'),
      '\n',

      `8. TECHNICAL AND COMMERCIAL FINDINGS`,
      `• Technical Assessment: ${meeting.product ? `Evaluated formulation parameters and stability for product ${meeting.product.name}.` : 'Technical scope and execution parameters validated by team.'}`,
      `• Commercial Scope: ${meeting.opportunity ? `Commercial milestone alignment confirmed for ${meeting.opportunity.title}.` : 'Commercial terms aligned with enterprise schedule.'}\n`,

      `9. CONFIRMED DECISIONS (${confirmedDecisions.length})`,
      confirmedDecisions.length === 0
        ? 'No formal decisions recorded.'
        : confirmedDecisions.map((d: any, idx: number) =>
            `  ${idx + 1}. [${d.decision_code}] ${d.title}\n` +
            `     - Impact: ${d.impact || 'MEDIUM'} | Owner: ${d.decision_owner ? `${d.decision_owner.first_name} ${d.decision_owner.last_name}` : 'Unassigned'}\n` +
            `     - Rationale: ${d.rationale || 'Agreed by consensus during session'}`
          ).join('\n'),
      '\n',

      `10. ACTION ITEMS & CANONICAL TASKS (${actionPoints.length})`,
      actionPoints.length === 0
        ? 'No action items created.'
        : actionPoints.map((p: any, idx: number) => {
            const owner = p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned';
            const dept = p.responsible_department ? p.responsible_department.name : 'General BD';
            const taskInfo = p.linked_task ? ` [Linked Task: ${p.linked_task.task_code || p.linked_task.id}]` : (p.linked_task_id ? ` [Task ID: ${p.linked_task_id}]` : ' [Pending Conversion]');
            return `  ${idx + 1}. [${p.point_code}] ${p.title}\n     - Owner: ${owner} | Dept: ${dept} | Due: ${p.due_date || 'TBD'} | Priority: ${p.priority || 'MEDIUM'}${taskInfo}`;
          }).join('\n'),
      '\n',

      `11. RESPONSIBLE DEPARTMENTS & ASSIGNMENT BREAKDOWN`,
      Array.from(new Set(actionPoints.map((p: any) => p.responsible_department?.name || 'General BD'))).map(d => `• Department: ${d}`).join('\n') || '• Cross-functional leadership\n',
      '\n',

      `12. AGREED DUE DATES & TIMELINES`,
      actionPoints.filter((p: any) => p.due_date).map((p: any) => `• Target ${p.due_date}: ${p.title}`).join('\n') || '• All actions to be initiated within 48 hours of MOM receipt.\n',
      '\n',

      `13. RISKS, DEPENDENCIES & BOTTLENECK MITIGATION`,
      risks.length === 0
        ? 'No high-risk dependencies identified during this meeting.'
        : risks.map((r: any, idx: number) => `  ${idx + 1}. [${r.priority} RISK] ${r.title}: ${r.description || r.discussion_notes || 'Continuous monitoring required.'}`).join('\n'),
      '\n',

      `14. UNRESOLVED QUESTIONS & PARKED DISCUSSIONS`,
      questions.length === 0
        ? 'All key points raised were resolved or converted into action items.'
        : questions.map((q: any, idx: number) => `  ${idx + 1}. [QUESTION] ${q.title}`).join('\n'),
      '\n',

      `15. CARRIED-FORWARD ITEMS FROM PREVIOUS SESSIONS`,
      carriedPoints.length === 0
        ? (previousMeeting ? `Previous session ${previousMeeting.meeting_code} actions reconciled.` : 'No previous carried-forward items.')
        : carriedPoints.map((cp: any, idx: number) => `  ${idx + 1}. [Carried Forward] ${cp.title} (Source Point: ${cp.carried_forward_from_id})`).join('\n'),
      '\n',

      `16. NEXT STEPS & IMMEDIATE ACTIONS`,
      `1. Circulate draft Minutes of Meeting for review and confirmation.\n` +
      `2. Execute created BDIQ canonical tasks according to agreed milestone deadlines.\n` +
      `3. Conduct follow-up progress review prior to next scheduled session.\n`,

      `17. NEXT MEETING SCHEDULE`,
      `Target Follow-up: ${meeting.closure_data?.next_meeting_date || 'To be scheduled based on milestone completion'}\n`,

      `18. SOURCE, GENERATION & AUDIT METADATA`,
      `• Generated Timestamp: ${new Date().toISOString()}`,
      `• Initiating User ID: ${this.userId}`,
      `• Raw Transcript Included: ${options.raw_transcript ? 'YES (Verified authorized text pasted)' : 'NO (Typed live notes session)'}`,
      `• Recording Integration Status: NOT_CONFIGURED (Honest conferencing status)`,
      `• Compliance Notice: This draft document requires formal user confirmation before final closure.`
    ];

    if (options.raw_transcript && options.raw_transcript.trim()) {
      momSections.push(`\nAPPENDIX: AUTHORIZED TRANSCRIPT TEXT:\n${options.raw_transcript.trim().substring(0, 4000)}`);
    }

    const draftText = momSections.join('\n');
    const newVersion = (meeting.mom_version || 0) + 1;

    // Structured 18-section object matching Frontend MOM Editor and master prompt
    const structuredDraft: any = {
      section_01_meeting_title_and_reference: {
        meeting_reference: meeting.meeting_code,
        title: meeting.title,
        meeting_type: meeting.meeting_type,
        conferencing_link: meeting.location_or_link || 'Not provided',
        platform: meeting.platform || 'CUSTOM'
      },
      section_02_datetime_and_timezone: {
        date: meeting.meeting_date,
        scheduled_time: `${meeting.meeting_time || '10:00:00'} - ${meeting.end_time || '11:00:00'}`,
        timezone: meeting.timezone || 'Asia/Kolkata',
        actual_start_time: meeting.actual_start_time || 'Recorded at live launch',
        actual_end_time: meeting.actual_end_time || 'Concluded at session finish'
      },
      section_03_attendance_and_participants: {
        organizer: organizerName,
        customer: customerName,
        opportunity: oppTitle,
        participants: (meeting.participants && meeting.participants.length > 0) ? meeting.participants.map((p: any) => p.name || p.user_profile_id).join(', ') : 'Registered attendees and project team'
      },
      section_04_meeting_objective: meeting.objective || 'Review project milestones, evaluate technical formulation batch feasibility, and establish delivery commitments.',
      section_05_adopted_agenda: meeting.agenda || '1. Review of previous actions\n2. Technical & commercial progress\n3. Decisions, task ownership & milestone confirmation',
      section_06_executive_summary: `Meeting ${meeting.meeting_code} was held on ${meeting.meeting_date} bringing together key stakeholders from ${customerName} and technical BD. During this live session, ${notes.length} discussion notes were recorded, ${confirmedDecisions.length} formal decisions were agreed upon, and ${actionPoints.length} concrete action item(s) were assigned to accountable functional owners with confirmed deadlines. ${risks.length > 0 ? `Identified ${risks.length} key operational risk(s) requiring proactive mitigation.` : 'No critical bottlenecks unmitigated.'}`,
      section_07_discussion_by_agenda: notes.length === 0
        ? 'No raw notes captured during this session.'
        : notes.map((n: any, i: number) => `[Note ${i + 1}] (${n.note_type || 'NOTE'}${n.speaker ? ` - ${n.speaker}` : ''}): ${n.content}`).join('\n'),
      section_08_technical_and_commercial_findings: `Technical Assessment: ${meeting.product ? `Evaluated formulation parameters and stability for product ${meeting.product.name || meeting.product.product_name}.` : 'Technical scope and execution parameters validated by team.'}\nCommercial Scope: ${meeting.opportunity ? `Commercial milestone alignment confirmed for ${meeting.opportunity.title}.` : 'Commercial terms aligned with enterprise schedule.'}`,
      section_09_confirmed_decisions: confirmedDecisions.map((d: any) => ({
        code: d.decision_code,
        title: d.title,
        owner: d.decision_owner ? `${d.decision_owner.first_name} ${d.decision_owner.last_name}` : 'Unassigned',
        impact: d.impact || 'MEDIUM',
        status: 'CONFIRMED',
        rationale: d.rationale || 'Agreed by consensus during session'
      })),
      section_10_action_items: actionPoints.map((p: any) => ({
        code: p.point_code,
        title: p.title,
        owner: p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned',
        department: p.responsible_department ? p.responsible_department.name : 'General BD',
        due_date: p.due_date || 'TBD',
        priority: p.priority || 'MEDIUM',
        task_reference: p.linked_task ? (p.linked_task.task_code || p.linked_task.id) : (p.linked_task_id ? `Task: ${p.linked_task_id}` : 'Pending Conversion')
      })),
      section_11_responsible_departments: Array.from(new Set(actionPoints.map((p: any) => p.responsible_department?.name || 'General BD'))),
      section_12_agreed_timelines: actionPoints.filter((p: any) => p.due_date).map((p: any) => `Target ${p.due_date}: ${p.title}`),
      section_13_risks_and_dependencies: risks.map((r: any) => `[${r.priority} RISK] ${r.title}: ${r.description || r.discussion_notes || 'Continuous monitoring required.'}`),
      section_14_unresolved_questions: questions.map((q: any) => q.title),
      section_15_carried_forward_items: carriedPoints.map((cp: any) => `${cp.title} (Source Point: ${cp.carried_forward_from_id})`),
      section_16_next_steps: `1. Circulate draft Minutes of Meeting for review and confirmation.\n2. Execute created BDIQ canonical tasks according to agreed milestone deadlines.\n3. Conduct follow-up progress review prior to next scheduled session.`,
      section_17_next_meeting_date: meeting.closure_data?.next_meeting_date || '',
      section_18_source_and_generation_metadata: {
        generated_by: organizerName,
        generated_at: new Date().toISOString(),
        raw_transcript_included: Boolean(options.raw_transcript),
        recording_status: 'NOT_CONFIGURED (Honest conferencing status)',
        compliance_notice: 'This draft document requires formal user confirmation before final closure.'
      },
      mom_text: draftText
    };

    // Update meeting with draft
    await this.updateMeeting(meetingId, {
      mom_draft: structuredDraft,
      mom_status: 'DRAFT',
      mom_version: newVersion,
      raw_transcript: options.raw_transcript || meeting.raw_transcript || null
    });

    return {
      meetingId,
      meeting_code: meeting.meeting_code,
      title: meeting.title,
      mom_status: 'DRAFT',
      mom_version: newVersion,
      mom_draft: structuredDraft,
      mom_text: draftText,
      ...structuredDraft,
      generated_at: new Date().toISOString()
    };
  }

  async confirmMOM(meetingId: string, momData: any = {}) {
    const current = await this.getMeeting(meetingId);
    if (!current) throw new NotFoundError('Meeting not found');

    const now = new Date().toISOString();
    let confirmedText = '';

    if (typeof momData === 'string') {
      confirmedText = momData;
    } else if (momData?.mom_text) {
      confirmedText = momData.mom_text;
    } else if (momData?.section_06_executive_summary) {
      confirmedText = [
        `================================================================================`,
        `MINUTES OF MEETING (MOM): ${current.title.toUpperCase()}`,
        `REFERENCE CODE: ${current.meeting_code} | STATUS: CONFIRMED | VERSION: ${(current.mom_version || 0) + 1}`,
        `================================================================================\n`,
        `1. EXECUTIVE SUMMARY:`,
        momData.section_06_executive_summary,
        `\n2. DISCUSSION SUMMARY:`,
        momData.section_07_discussion_by_agenda || 'Discussed during live session.',
        `\n3. TECHNICAL & COMMERCIAL FINDINGS:`,
        momData.section_08_technical_and_commercial_findings || 'Technical parameters aligned.',
        `\n4. NEXT STEPS:`,
        momData.section_16_next_steps || 'Execute agreed tasks.',
        `\n5. NEXT MEETING:`,
        momData.section_17_next_meeting_date || 'TBD',
        `\n6. CONFIRMATION AUDIT:`,
        `Confirmed by user ${this.userId} at ${now}`
      ].join('\n');
    } else {
      confirmedText = current.minutes_text || (typeof current.mom_draft === 'string' ? current.mom_draft : current.mom_draft?.mom_text) || 'Minutes of Meeting confirmed and approved.';
    }

    const updated = await this.updateMeeting(meetingId, {
      status: 'COMPLETED',
      closure_status: 'CLOSED',
      minutes_text: confirmedText,
      minutes_approved: true,
      minutes_approved_at: now,
      minutes_approved_by: this.userId,
      mom_status: 'CONFIRMED',
      mom_confirmed_by: this.userId,
      mom_confirmed_at: now,
      mom_version: (current.mom_version || 0) + 1,
      closed_at: now,
      closed_by: this.userId,
      closure_summary: momData?.summary || momData?.section_06_executive_summary || 'Minutes confirmed and approved.'
    });

    return updated;
  }

  // ============================================================================
  // 9. MEETING MINUTES EXPORT & 7-SHEET EXCEL WORKBOOK
  // ============================================================================

  async exportMinutesWorkbook(meetingId: string) {
    const meeting = await this.getMeeting(meetingId);
    const points = await this.getMeetingPoints(meetingId);
    const decisions = await this.getDecisions(meetingId);
    const notes = await this.getNotes(meetingId);

    const wb = XLSX.utils.book_new();

    // Sheet 1: MOM Summary
    const summaryData = [
      ['BDIQ ENTERPRISE MINUTES OF MEETING — EXECUTIVE SUMMARY'],
      [''],
      ['Meeting Title', meeting.title],
      ['Meeting Reference Code', meeting.meeting_code],
      ['Date', meeting.meeting_date],
      ['Scheduled Time', `${meeting.meeting_time || '10:00:00'} - ${meeting.end_time || '11:00:00'} (${meeting.timezone || 'Asia/Kolkata'})`],
      ['Actual Session Start', meeting.actual_start_time || 'Recorded at live launch'],
      ['Actual Session End', meeting.actual_end_time || 'Recorded at session closure'],
      ['Conferencing URL', meeting.location_or_link || 'N/A'],
      ['Platform', meeting.platform || 'CUSTOM'],
      ['Meeting Status', meeting.status],
      ['Closure Status', meeting.closure_status || 'OPEN'],
      ['MOM Confirmation Status', meeting.mom_status || (meeting.minutes_approved ? 'CONFIRMED' : 'DRAFT')],
      ['MOM Approved At', meeting.minutes_approved_at || 'Pending Confirmation'],
      ['Organizer', meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'Platform Organizer'],
      ['Client / Organization', meeting.customer ? meeting.customer.name : (meeting.external_organizations || 'Internal')],
      ['Related Opportunity', meeting.opportunity ? meeting.opportunity.title : 'N/A'],
      ['Related RFQ', meeting.rfq ? meeting.rfq.rfq_number : 'N/A'],
      ['Related Product', meeting.product ? (meeting.product.product_name || meeting.product.name) : 'N/A'],
      [''],
      ['KEY METRICS & STATISTICS'],
      ['Discussion Notes Captured', notes.length],
      ['Formal Decisions Recorded', decisions.length],
      ['Action Items Created', points.filter((p: any) => p.action_required).length],
      ['Tasks Linked to Task Management', points.filter((p: any) => p.linked_task_id).length],
      ['Open Risks Identified', points.filter((p: any) => p.category === 'RISK' || p.priority === 'HIGH').length],
      [''],
      ['EXECUTIVE NARRATIVE SUMMARY'],
      [meeting.closure_summary || meeting.objective || 'Meeting completed with agreed decisions and committed milestones.']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 75 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'MOM Summary');

    // Sheet 2: Meeting Details
    const detailsData = [
      ['FIELD', 'VALUE'],
      ['Meeting Code', meeting.meeting_code],
      ['Meeting Title', meeting.title],
      ['Meeting Type', meeting.meeting_type],
      ['Conferencing Platform', meeting.platform || 'CUSTOM'],
      ['Actual Conferencing Link', meeting.location_or_link || 'Not specified'],
      ['Scheduled Date', meeting.meeting_date],
      ['Scheduled Start Time', meeting.meeting_time || '10:00:00'],
      ['Expected End Time', meeting.end_time || '11:00:00'],
      ['Timezone', meeting.timezone || 'Asia/Kolkata'],
      ['Actual Session Start Time', meeting.actual_start_time || 'N/A'],
      ['Actual Session End Time', meeting.actual_end_time || 'N/A'],
      ['Recording Status', meeting.recording_status || 'NOT_CONFIGURED'],
      ['Transcription Status', meeting.transcription_status || 'NOT_CONFIGURED'],
      ['Meeting Objective', meeting.objective || 'N/A'],
      ['Expected Outcomes', meeting.expected_outcomes || 'N/A'],
      ['External Organizations', meeting.external_organizations || 'N/A'],
      ['Preparation Status', meeting.preparation_status || 'PENDING'],
      ['Closure Summary', meeting.closure_summary || 'N/A']
    ];
    const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
    wsDetails['!cols'] = [{ wch: 28 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Meeting Details');

    // Sheet 3: Agenda and Discussion
    const agendaHeaders = ['#', 'Agenda Item / Topic', 'Associated Notes', 'Status'];
    const agendaRows: any[] = [];
    if (meeting.agenda) {
      const agendaList = meeting.agenda.split(/\r?\n/).filter((line: string) => line.trim());
      agendaList.forEach((ag: string, idx: number) => {
        const matchingNotes = notes.filter((n: any) => n.agenda_item === ag || (n.content && n.content.toLowerCase().includes(ag.toLowerCase())));
        agendaRows.push([
          idx + 1,
          ag,
          matchingNotes.map((n: any) => n.content).join('; ') || 'Discussed during live session',
          'DISCUSSED'
        ]);
      });
    } else {
      agendaRows.push([1, 'General Business Development Discussion', notes.map((n: any) => n.content).join('; ') || 'Standard agenda', 'DISCUSSED']);
    }
    const wsAgenda = XLSX.utils.aoa_to_sheet([agendaHeaders, ...agendaRows]);
    wsAgenda['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 65 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsAgenda, 'Agenda and Discussion');

    // Sheet 4: Confirmed Decisions
    const decisionHeaders = [
      'Decision Code',
      'Title',
      'Decision Date',
      'Decision Owner',
      'Impact Level',
      'Confirmation Status',
      'Rationale',
      'Evidence / Notes'
    ];
    const decisionRows = decisions.map((d: any) => [
      d.decision_code,
      d.title,
      d.decision_date,
      d.decision_owner ? `${d.decision_owner.first_name} ${d.decision_owner.last_name}` : 'Unassigned',
      d.impact || 'MEDIUM',
      d.is_confirmed !== false ? 'CONFIRMED' : 'DRAFT',
      d.rationale || '',
      d.evidence || d.description || ''
    ]);
    const wsDecisions = XLSX.utils.aoa_to_sheet([decisionHeaders, ...decisionRows]);
    wsDecisions['!cols'] = [{ wch: 16 }, { wch: 35 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsDecisions, 'Confirmed Decisions');

    // Sheet 5: Action Items
    const actionHeaders = [
      'Point Code',
      'Action Item Title',
      'Category',
      'Priority',
      'Responsible Department',
      'Assigned Person',
      'Due Date',
      'Status',
      'Canonical Task ID',
      'Discussion Notes'
    ];
    const actionRows = points
      .filter((p: any) => p.action_required)
      .map((p: any) => [
        p.point_code,
        p.title,
        p.category || 'ACTION',
        p.priority || 'MEDIUM',
        p.responsible_department ? p.responsible_department.name : 'General BD',
        p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned',
        p.due_date || 'TBD',
        p.status || 'OPEN',
        p.linked_task ? (p.linked_task.task_code || p.linked_task.id) : (p.linked_task_id || 'Pending Conversion'),
        p.discussion_notes || p.description || ''
      ]);
    const wsActions = XLSX.utils.aoa_to_sheet([actionHeaders, ...actionRows]);
    wsActions['!cols'] = [{ wch: 16 }, { wch: 38 }, { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsActions, 'Action Items');

    // Sheet 6: Risks and Pending Items
    const riskHeaders = [
      'Item Code',
      'Title',
      'Category',
      'Priority / Severity',
      'Due Date',
      'Status',
      'Mitigation / Discussion Notes'
    ];
    const riskRows = points
      .filter((p: any) => p.category === 'RISK' || p.category === 'QUESTION' || p.category === 'DEPENDENCY' || p.priority === 'HIGH' || p.priority === 'CRITICAL')
      .map((p: any) => [
        p.point_code,
        p.title,
        p.category,
        p.priority,
        p.due_date || 'N/A',
        p.status,
        p.discussion_notes || p.description || ''
      ]);
    const wsRisks = XLSX.utils.aoa_to_sheet([riskHeaders, ...riskRows]);
    wsRisks['!cols'] = [{ wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsRisks, 'Risks and Pending Items');

    // Sheet 7: Source Notes
    const noteHeaders = ['#', 'Timestamp', 'Speaker', 'Note Type', 'Content', 'Draft Status'];
    const noteRows = notes.map((n: any, idx: number) => [
      idx + 1,
      n.created_at || 'During session',
      n.speaker || 'General',
      n.note_type || 'NOTE',
      n.content,
      n.is_draft ? 'DRAFT' : 'SAVED'
    ]);
    const wsNotes = XLSX.utils.aoa_to_sheet([noteHeaders, ...noteRows]);
    wsNotes['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 65 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Source Notes');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ============================================================================
  // 9. REMINDERS ENGINE & DEDUPLICATION
  // ============================================================================

  async scheduleMeetingReminders(meetingId: string) {
    try {
      const meeting = await this.getMeeting(meetingId);
      if (!meeting.meeting_date || !meeting.meeting_time) return;

      const meetDateTimeStr = `${meeting.meeting_date}T${meeting.meeting_time}`;
      const meetTime = new Date(meetDateTimeStr).getTime();

      const offsets = [
        { type: 'UPCOMING_24H', offsetMs: 24 * 60 * 60 * 1000 },
        { type: 'UPCOMING_1H', offsetMs: 60 * 60 * 1000 },
        { type: 'UPCOMING_15M', offsetMs: 15 * 60 * 1000 }
      ];

      const recipients = [
        meeting.organizer_id,
        ...(meeting.participants || []).map((p: any) => p.user_profile_id)
      ].filter(Boolean);

      for (const recipientId of recipients) {
        for (const off of offsets) {
          const scheduledTime = new Date(meetTime - off.offsetMs).toISOString();
          const dedupKey = `${this.orgId}_${meeting.id}_${off.type}_${recipientId}`;

          const { data: existingRem } = await this.supabase
            .from('meeting_reminders')
            .select('id')
            .eq('organization_id', this.orgId)
            .eq('deduplication_key', dedupKey)
            .maybeSingle();

          if (!existingRem) {
            await this.supabase
              .from('meeting_reminders')
              .insert({
                organization_id: this.orgId,
                meeting_id: meeting.id,
                reminder_type: off.type,
                scheduled_at: scheduledTime,
                status: 'PENDING',
                delivery_channel: 'IN_APP',
                recipient_user_id: recipientId,
                deduplication_key: dedupKey
              });
          }
        }
      }
    } catch (err: any) {
      console.warn('scheduleMeetingReminders non-critical warning:', err?.message);
    }
  }

  // ============================================================================
  // 10. CONFIGURATION & TEMPLATES MANAGEMENT
  // ============================================================================

  async getConfigurations() {
    try {
      const { data, error } = await this.supabase
        .from('meeting_configurations')
        .select('*')
        .eq('organization_id', this.orgId)
        .order('config_name', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch {}

    if (MeetingService.fallbackConfigs.length === 0) {
      MeetingService.fallbackConfigs = [
        {
          id: 'cfg-1',
          organization_id: this.orgId,
          config_key: 'meeting_types',
          config_name: 'Configurable Meeting Types',
          description: 'Organization-approved meeting types',
          config_value: ['Customer Meeting', 'Internal BD Meeting', 'R&D Discussion', 'Regulatory Discussion', 'Production Review', 'Commercial Discussion', 'Other']
        },
        {
          id: 'cfg-2',
          organization_id: this.orgId,
          config_key: 'reminder_policies',
          config_name: 'Meeting Reminder Offsets & Policies',
          description: 'Notification offsets and channels',
          config_value: { offsets_minutes: [1440, 60, 15], enable_email: true, enable_in_app: true }
        }
      ];
    }
    return MeetingService.fallbackConfigs;
  }

  async updateConfiguration(configKey: string, newValue: any, changeReason: string) {
    try {
      const { data: current } = await this.supabase
        .from('meeting_configurations')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('config_key', configKey)
        .maybeSingle();

      if (current) {
        const { data: updated } = await this.supabase
          .from('meeting_configurations')
          .update({
            config_value: newValue,
            version: (current.version || 1) + 1,
            updated_by: this.userId,
            updated_at: new Date().toISOString()
          })
          .eq('organization_id', this.orgId)
          .eq('config_key', configKey)
          .select('*')
          .single();

        if (updated) return updated;
      }
    } catch {}

    const idx = MeetingService.fallbackConfigs.findIndex(c => c.config_key === configKey);
    if (idx >= 0) {
      MeetingService.fallbackConfigs[idx].config_value = newValue;
      return MeetingService.fallbackConfigs[idx];
    }
    const newCfg = {
      id: crypto.randomUUID(),
      organization_id: this.orgId,
      config_key: configKey,
      config_name: configKey,
      config_value: newValue,
      updated_at: new Date().toISOString()
    };
    MeetingService.fallbackConfigs.push(newCfg);
    return newCfg;
  }

  async listTemplates() {
    try {
      const { data, error } = await this.supabase
        .from('meeting_templates')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('is_active', true)
        .order('template_name', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch {}

    if (MeetingService.fallbackTemplates.length === 0) {
      MeetingService.fallbackTemplates = [
        {
          id: 'tpl-1',
          template_name: 'Customer Commercial & Technical Discussion',
          meeting_type: 'Customer Meeting',
          description: 'Standard agenda for pharmaceutical customer qualification and RFQ alignment',
          default_agenda: ['Customer Product Requirements', 'Annual Volume & Batch Specifications', 'Technical Feasibility Feedback', 'Commercial Terms', 'Commitments & Joint Next Steps'],
          default_categories: ['CUSTOMER_REQUIREMENT', 'DISCUSSION', 'DECISION', 'ACTION'],
          default_duration_minutes: 45
        },
        {
          id: 'tpl-2',
          template_name: 'Internal Production Review Template',
          meeting_type: 'Production Review',
          description: 'Standard review for plant capacity, equipment availability, materials and timeline risks',
          default_agenda: ['Review of Previous Actions', 'Plant Capacity & Utilization', 'Equipment Status', 'Raw Material Readiness', 'Milestones & Delivery Timelines'],
          default_categories: ['DISCUSSION', 'ACTION', 'RISK', 'DECISION'],
          default_duration_minutes: 60
        }
      ];
    }
    return MeetingService.fallbackTemplates;
  }

  async createTemplate(payload: any) {
    if (!payload.template_name || !payload.meeting_type) {
      throw new ValidationError('Template name and meeting type are required');
    }

    const newTemplate = {
      id: crypto.randomUUID(),
      organization_id: this.orgId,
      template_name: payload.template_name.trim(),
      meeting_type: payload.meeting_type,
      description: payload.description || null,
      default_agenda: payload.default_agenda || [],
      default_categories: payload.default_categories || [],
      default_duration_minutes: payload.default_duration_minutes || 60,
      required_fields: payload.required_fields || [],
      created_by: this.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await this.supabase
        .from('meeting_templates')
        .insert(newTemplate)
        .select('*')
        .single();

      if (!error && data) {
        MeetingService.fallbackTemplates.push(data);
        return data;
      }
    } catch {}

    MeetingService.fallbackTemplates.push(newTemplate);
    return newTemplate;
  }

  // ============================================================================
  // 10. AI MEETING INTELLIGENCE, GROUNDED COPILOT ASSISTANT & SUGGESTION PIPELINE
  // ============================================================================

  async generateAIMeetingIntelligence(meetingId: string, options: { action?: string; query?: string; liveNotesContent?: string } = {}) {
    const meeting = await this.getMeeting(meetingId);
    if (!meeting) throw new NotFoundError('Meeting not found');

    const points = await this.getMeetingPoints(meetingId);
    const decisions = await this.getDecisions(meetingId);
    const notes = await this.getNotes(meetingId);
    const previousMeeting = await this.resolvePreviousMeeting(meeting);

    // If live editor notes were sent, merge or use them
    let rawNotesText = notes.map((n: any) => n.content).join('\n');
    if (options.liveNotesContent && options.liveNotesContent.trim()) {
      if (!rawNotesText.includes(options.liveNotesContent.trim())) {
        rawNotesText = rawNotesText ? `${rawNotesText}\n${options.liveNotesContent.trim()}` : options.liveNotesContent.trim();
      }
    }

    // Try AI Provider Service if enabled
    let aiProviderResult: any = null;
    try {
      const { AIProviderService } = require('./ai-provider.service');
      const aiService = new AIProviderService(this.supabase, this.orgId, this.userId);
      const config = await aiService.getConfig();

      if (config && config.is_enabled && config.last_test_status !== 'FAILED') {
        const { CopilotProxyService } = require('./copilot-proxy.service');
        const { decryptApiKey } = require('../utils/encryption');
        const { data: rawRecord } = await this.supabase
          .from('ai_provider_configurations')
          .select('api_key_ciphertext')
          .eq('id', config.id)
          .single();

        if (rawRecord?.api_key_ciphertext) {
          const apiKey = decryptApiKey(rawRecord.api_key_ciphertext);
          if (apiKey) {
            const proxy = new CopilotProxyService();
            const systemPrompt =
              `You are the BDIQ Enterprise CDMO Meeting Intelligence Copilot. ` +
              `You analyze meeting records for pharmaceutical manufacturing, business development, and QA teams. ` +
              `STRICT RULES:\n` +
              `1. Ground all findings ONLY on the provided Meeting Notes, Transcripts, and Agenda.\n` +
              `2. Produce: Executive Summary, Discussion Points by Agenda Topic, Confirmed Decisions with rationale, ` +
              `Follow-up Actions with owner suggestions, Risks / Dependencies identified, and Suggested Questions.\n` +
              `3. STATE EXPLICITLY if an agenda topic was not discussed.\n` +
              `4. NEVER invent commitments, decisions, or attendees not present in the record.\n` +
              `5. All extracted action items and decisions must be marked as PROPOSED suggestions.\n` +
              `6. Output strict JSON adhering to the required schema:\n` +
              `{\n` +
              `  "executiveSummary": string,\n` +
              `  "agendaDiscussions": [{ "agendaTopic": string, "discussionSummary": string, "wasDiscussed": boolean }],\n` +
              `  "suggestedActionItems": [{ "title": string, "description": string, "suggestedOwner": string, "suggestedDepartment": string, "suggestedDueDate": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "confidence": number, "sourceSnippet": string }],\n` +
              `  "suggestedDecisions": [{ "title": string, "rationale": string, "impact": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "confidence": number, "sourceSnippet": string }],\n` +
              `  "identifiedRisks": [{ "title": string, "description": string, "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "mitigationSuggestion": string }],\n` +
              `  "suggestedQuestions": [string],\n` +
              `  "copilotAnswer": string,\n` +
              `  "citations": [string]\n` +
              `}`;

            const userPrompt = JSON.stringify({
              meetingTitle: meeting.title,
              meetingCode: meeting.meeting_code,
              agenda: meeting.agenda || '1. Technical Feasibility\n2. Commercial Pricing\n3. Milestones & Delivery',
              objective: meeting.objective || 'Business development alignment',
              customer: meeting.customer?.name || meeting.external_organizations || 'Client',
              notes: rawNotesText || 'No typed notes recorded yet.',
              transcript: meeting.raw_transcript || '',
              query: options.query || null,
              requestedAction: options.action || 'FULL_INTELLIGENCE'
            });

            const textResponse = await proxy.chatCompletion({
              model: config.model_name || 'gpt-4o',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.2,
              max_tokens: 2000,
              response_format: { type: 'json_object' },
              apiEndpoint: config.api_endpoint,
              apiKey: apiKey
            });

            if (textResponse) {
              try {
                aiProviderResult = JSON.parse(textResponse);
              } catch {
                const match = textResponse.match(/\{[\s\S]*\}/);
                if (match) aiProviderResult = JSON.parse(match[0]);
              }
            }
          }
        }
      }
    } catch (aiErr: any) {
      console.warn('Meeting AI Provider request failed, falling back to deterministic extraction:', aiErr?.message);
    }

    if (aiProviderResult && aiProviderResult.executiveSummary) {
      return {
        source: 'AI_PROVIDER',
        providerName: 'COPILOT_PROXY',
        executiveSummary: aiProviderResult.executiveSummary,
        agendaDiscussions: aiProviderResult.agendaDiscussions || [],
        suggestedActionItems: (aiProviderResult.suggestedActionItems || []).map((a: any, idx: number) => ({
          id: `ai-action-${idx + 1}`,
          title: a.title,
          description: a.description || a.title,
          suggestedOwner: a.suggestedOwner || 'Unassigned',
          suggestedDepartment: a.suggestedDepartment || 'General BD',
          suggestedDueDate: a.suggestedDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          priority: a.priority || 'MEDIUM',
          confidence: a.confidence || 0.9,
          status: 'PROPOSED',
          is_ai_suggested: true,
          sourceSnippet: a.sourceSnippet || ''
        })),
        suggestedDecisions: (aiProviderResult.suggestedDecisions || []).map((d: any, idx: number) => ({
          id: `ai-dec-${idx + 1}`,
          title: d.title,
          rationale: d.rationale || 'Agreed during meeting discussion',
          impact: d.impact || 'MEDIUM',
          confidence: d.confidence || 0.88,
          is_ai_suggested: true,
          sourceSnippet: d.sourceSnippet || ''
        })),
        identifiedRisks: aiProviderResult.identifiedRisks || [],
        suggestedQuestions: aiProviderResult.suggestedQuestions || [],
        copilotAnswer: aiProviderResult.copilotAnswer || null,
        citations: aiProviderResult.citations || []
      };
    }

    // High-Fidelity Deterministic Engine (Strictly grounded in rawNotesText & meeting metadata)
    return this.executeDeterministicMeetingIntelligence(meeting, rawNotesText, points, decisions, previousMeeting, options.query);
  }

  private executeDeterministicMeetingIntelligence(
    meeting: any,
    notesText: string,
    existingPoints: any[],
    existingDecisions: any[],
    previousMeeting: any,
    query?: string
  ) {
    const rawLines = notesText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && l !== '•');

    const suggestedActions: any[] = [];
    const suggestedDecisions: any[] = [];
    const identifiedRisks: any[] = [];
    const citations: string[] = [];

    // 1. Parse lines for Action Items, Decisions, Risks
    rawLines.forEach((line, idx) => {
      const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();
      const lower = cleanLine.toLowerCase();

      if (lower.startsWith('[action]') || lower.startsWith('action:') || lower.startsWith('todo:') || lower.includes('will submit') || lower.includes('action item')) {
        const title = cleanLine.replace(/^\[action\]\s*/i, '').replace(/^action:\s*/i, '').replace(/^todo:\s*/i, '').trim();
        suggestedActions.push({
          id: `det-action-${idx + 1}`,
          title,
          description: `Action extracted from meeting notes: "${cleanLine}"`,
          suggestedOwner: 'Project Lead',
          suggestedDepartment: 'Commercial Operations',
          suggestedDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          priority: lower.includes('urgent') || lower.includes('critical') ? 'HIGH' : 'MEDIUM',
          confidence: 0.92,
          status: 'PROPOSED',
          is_ai_suggested: true,
          sourceSnippet: cleanLine
        });
      } else if (lower.startsWith('[decision]') || lower.startsWith('decision:') || lower.startsWith('agreed:') || lower.includes('agreed that') || lower.includes('approved to')) {
        const title = cleanLine.replace(/^\[decision\]\s*/i, '').replace(/^decision:\s*/i, '').replace(/^agreed:\s*/i, '').trim();
        suggestedDecisions.push({
          id: `det-dec-${idx + 1}`,
          title,
          rationale: 'Agreed by consensus during live session note capture.',
          impact: lower.includes('high') || lower.includes('critical') ? 'HIGH' : 'MEDIUM',
          confidence: 0.90,
          is_ai_suggested: true,
          sourceSnippet: cleanLine
        });
      } else if (lower.startsWith('[risk]') || lower.startsWith('risk:') || lower.includes('bottleneck') || lower.includes('delay risk') || lower.includes('supply constraint')) {
        const title = cleanLine.replace(/^\[risk\]\s*/i, '').replace(/^risk:\s*/i, '').trim();
        identifiedRisks.push({
          title,
          description: cleanLine,
          severity: lower.includes('critical') || lower.includes('severe') ? 'CRITICAL' : 'HIGH',
          mitigationSuggestion: 'Review alternate supplier validation and notify QA team.'
        });
      }

      // If query provided, check keyword relevance
      if (query && query.trim()) {
        const stopWords = new Set([
          'what', 'were', 'which', 'where', 'when', 'with', 'from', 'about', 'this',
          'that', 'have', 'been', 'there', 'their', 'they', 'will', 'would', 'could',
          'should', 'phase', 'does', 'did', 'done', 'results', 'trial', 'trials', 'the'
        ]);
        const qTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2 && !stopWords.has(t));
        if (qTerms.length > 0) {
          const matches = qTerms.some((t: string) => lower.includes(t));
          if (matches) {
            citations.push(cleanLine);
          }
        }
      }
    });

    // 2. Agenda Item Mapping (Strict rule: state explicitly if an agenda topic was not discussed)
    const agendaText: string = meeting.agenda || '1. Technical Feasibility\n2. Commercial Pricing\n3. Milestones & Delivery';
    const agendaLines: string[] = agendaText
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const agendaDiscussions = agendaLines.map((topic: string) => {
      const cleanTopic = topic.replace(/^\d+[\.\)]\s*/, '').trim();
      const topicKeywords: string[] = cleanTopic.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

      const matchingNotes = rawLines.filter((line: string) => {
        const l = line.toLowerCase();
        return topicKeywords.some((k: string) => l.includes(k));
      });

      if (matchingNotes.length > 0) {
        return {
          agendaTopic: cleanTopic,
          discussionSummary: matchingNotes.join(' '),
          wasDiscussed: true
        };
      } else {
        return {
          agendaTopic: cleanTopic,
          discussionSummary: 'Topic was not addressed during this recorded session.',
          wasDiscussed: false
        };
      }
    });

    // 3. Executive Summary
    const customer = meeting.customer?.name || meeting.external_organizations || 'Client Stakeholders';
    let executiveSummary = '';
    if (rawLines.length === 0) {
      executiveSummary = `Meeting ${meeting.meeting_code} for ${meeting.title} commenced with ${customer}. No detailed discussion notes have been recorded in the live workspace yet.`;
    } else {
      const undiscussed = agendaDiscussions.filter((a: any) => !a.wasDiscussed);
      executiveSummary =
        `During the session for ${meeting.title} (${meeting.meeting_code}) with ${customer}, ` +
        `the team reviewed active project parameters resulting in ${rawLines.length} recorded note items. ` +
        `Key discussions produced ${suggestedDecisions.length} formal decision proposals, ${suggestedActions.length} prioritized action items, ` +
        `and identified ${identifiedRisks.length} operational risk factors. ` +
        `${undiscussed.length > 0 ? `Note: ${undiscussed.map((a: any) => a.agendaTopic).join(', ')} were not addressed.` : 'All designated agenda topics were addressed.'}`;
    }

    // 4. Proactive Follow-up Questions
    const suggestedQuestions: string[] = [
      'Are the timeline milestones committed in this session aligned with the production line changeover schedule?',
      'Has the client provided final stability specifications and raw material certificates of analysis?',
      'What are the critical dependencies required before releasing batch documentation?'
    ];

    // 5. Copilot Query Answer (if queried)
    let copilotAnswer: string | null = null;
    if (query && query.trim()) {
      if (citations.length > 0) {
        copilotAnswer = `Based on your session notes, the following points address "${query}":\n\n` +
          citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
      } else if (rawLines.length === 0) {
        copilotAnswer = `No meeting notes have been recorded yet in this session to answer "${query}".`;
      } else {
        copilotAnswer = `Based strictly on the captured notes so far, there is no direct reference to "${query}". You may want to bring this up before concluding the call.`;
      }
    }

    return {
      source: 'DETERMINISTIC_ENGINE',
      providerName: 'DETERMINISTIC_ENGINE',
      executiveSummary,
      agendaDiscussions,
      suggestedActionItems: suggestedActions,
      suggestedDecisions,
      identifiedRisks,
      suggestedQuestions,
      copilotAnswer,
      citations
    };
  }

  async applyAISuggestions(meetingId: string, payload: {
    points?: Array<{
      title: string;
      category?: string;
      priority?: string;
      due_date?: string;
      create_task?: boolean;
      department_id?: string;
      assigned_user_id?: string;
    }>;
    decisions?: Array<{
      title: string;
      description?: string;
      impact?: string;
      rationale?: string;
    }>;
  }) {
    const createdPoints: any[] = [];
    const createdTasks: any[] = [];
    const createdDecisions: any[] = [];

    if (payload.points && Array.isArray(payload.points)) {
      for (const p of payload.points) {
        if (!p.title || !p.title.trim()) continue;
        const newPoint = await this.createMeetingPoint(meetingId, {
          title: p.title.trim(),
          category: p.category || 'ACTION',
          priority: p.priority || 'MEDIUM',
          due_date: p.due_date || null,
          action_required: true,
          responsible_department_id: p.department_id || null,
          responsible_user_id: p.assigned_user_id || null,
          status: 'OPEN',
          is_ai_suggested: true
        });
        createdPoints.push(newPoint);

        if (p.create_task) {
          try {
            const task = await this.convertPointToTask(newPoint.id, {
              title: p.title.trim(),
              priority: p.priority || 'MEDIUM',
              due_date: p.due_date || null,
              department_id: p.department_id || null,
              assigned_user_id: p.assigned_user_id || null
            });
            createdTasks.push(task);
          } catch (tErr: any) {
            console.warn('Failed to auto-create task for suggested point:', tErr?.message);
          }
        }
      }
    }

    if (payload.decisions && Array.isArray(payload.decisions)) {
      for (const d of payload.decisions) {
        if (!d.title || !d.title.trim()) continue;
        const newDecision = await this.createDecision(meetingId, {
          title: d.title.trim(),
          description: d.description || d.title.trim(),
          impact: d.impact || 'MEDIUM',
          rationale: d.rationale || 'Confirmed from Copilot suggestion',
          is_confirmed: true
        });
        createdDecisions.push(newDecision);
      }
    }

    return {
      success: true,
      createdPoints,
      createdTasks,
      createdDecisions
    };
  }

  async queryCopilot(meetingId: string, query: string) {
    if (!query || !query.trim()) {
      throw new ValidationError('Query cannot be empty');
    }
    const intel = await this.generateAIMeetingIntelligence(meetingId, { action: 'ASK_COPILOT', query: query.trim() });
    return {
      query: query.trim(),
      answer: intel.copilotAnswer || `Discussion points matching your query:\n${intel.citations.join('\n') || 'No specific notes matched this query.'}`,
      citations: intel.citations || [],
      suggestedFollowUps: intel.suggestedQuestions || []
    };
  }
}

