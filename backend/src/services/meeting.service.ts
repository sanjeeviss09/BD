import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { TaskService } from './task.service';
import { TaskMetricsService, calendarDaysDiff } from './task-metrics.service';
import { ResponsibilityService } from './responsibility.service';
import { MeetingQuickCaptureService } from './meeting-quick-capture.service';

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

  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {
    this.taskService = new TaskService(supabase, orgId, userId);
    this.responsibilityService = new ResponsibilityService(supabase, orgId, userId);
  }

  // ============================================================================
  // 1. DASHBOARD & OVERVIEW AGGREGATION
  // ============================================================================

  async getDashboardOverview(filters: MeetingFilterOptions = {}) {
    const today = new Date().toISOString().split('T')[0];

    // Fetch meetings
    let meetingQuery = this.supabase
      .from('meetings')
      .select(`
        *,
        organizer:user_profiles!organizer_id(id, first_name, last_name, email),
        department:departments(id, name),
        customer:customers(id, name),
        opportunity:opportunities(id, title),
        rfq:rfqs(id, rfq_number),
        product:products(id, name)
      `)
      .eq('organization_id', this.orgId)
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true });

    if (filters.status) meetingQuery = meetingQuery.eq('status', filters.status);
    if (filters.meeting_type) meetingQuery = meetingQuery.eq('meeting_type', filters.meeting_type);
    if (filters.customer_id) meetingQuery = meetingQuery.eq('customer_id', filters.customer_id);
    if (filters.opportunity_id) meetingQuery = meetingQuery.eq('opportunity_id', filters.opportunity_id);

    const { data: allMeetings, error: meetErr } = await meetingQuery;
    if (meetErr) throw new AppError(meetErr.message, 500);

    const meetings = allMeetings || [];

    // Fetch meeting points for action statistics
    const { data: allPoints } = await this.supabase
      .from('meeting_points')
      .select('*, meeting:meetings!meeting_id(title, meeting_date)')
      .eq('organization_id', this.orgId);

    const points = allPoints || [];

    // Fetch tasks linked to meetings
    const { data: meetingTasks } = await this.supabase
      .from('tasks')
      .select('*, task_followups(*)')
      .eq('organization_id', this.orgId)
      .not('meeting_id', 'is', null);

    const tasks = meetingTasks || [];

    // Metrics calculation
    const todayMeetings = meetings.filter(m => m.meeting_date === today);
    const upcomingMeetings = meetings.filter(m => m.meeting_date > today);
    const awaitingPreparation = meetings.filter(
      m => m.preparation_status === 'PENDING' && m.meeting_date >= today && m.status === 'SCHEDULED'
    );
    const inProgressMeetings = meetings.filter(m => m.status === 'IN_PROGRESS');
    const awaitingClosure = meetings.filter(
      m => (m.status === 'COMPLETED' || m.meeting_date < today) && m.closure_status !== 'CLOSED'
    );

    const pendingActions = points.filter(p => p.action_required && p.status !== 'RESOLVED' && p.status !== 'CANCELLED');
    const overdueMeetingActions = pendingActions.filter(p => p.due_date && p.due_date < today);

    // Follow-ups due today and overdue
    const followupsDueToday = tasks.filter(t => t.current_due_date === today && t.status !== 'COMPLETED');
    const overdueFollowups = tasks.filter(t => t.current_due_date && t.current_due_date < today && t.status !== 'COMPLETED');

    const previousActionsStillOpen = points.filter(p => p.carried_forward_from_id && p.status !== 'RESOLVED');
    const meetingsWithoutMinutes = meetings.filter(m => m.status === 'COMPLETED' && !m.minutes_approved);
    const meetingsWithoutNextSteps = meetings.filter(
      m => m.status === 'COMPLETED' && (!m.closure_data || !m.closure_data.next_meeting_date)
    );

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
        followupsDueTodayCount: followupsDueToday.length,
        overdueFollowupsCount: overdueFollowups.length,
        previousActionsStillOpenCount: previousActionsStillOpen.length,
        meetingsWithoutMinutesCount: meetingsWithoutMinutes.length,
        meetingsWithoutNextStepsCount: meetingsWithoutNextSteps.length,
      },
      todayMeetings,
      upcomingMeetings,
      awaitingPreparation,
      inProgressMeetings,
      awaitingClosure,
      pendingActions,
      overdueMeetingActions,
      followupsDueToday,
      overdueFollowups,
      meetings
    };
  }

  // ============================================================================
  // 2. MEETING CREATION, LISTING & CRUD
  // ============================================================================

  async listMeetings(query: MeetingFilterOptions = {}) {
    let q = this.supabase
      .from('meetings')
      .select(`
        *,
        organizer:user_profiles!organizer_id(id, first_name, last_name, email),
        department:departments(id, name),
        customer:customers(id, name),
        opportunity:opportunities(id, title),
        rfq:rfqs(id, rfq_number),
        product:products(id, name),
        series:meeting_series(id, title, recurrence_type)
      `)
      .eq('organization_id', this.orgId)
      .order('meeting_date', { ascending: false })
      .order('meeting_time', { ascending: false });

    if (query.status) q = q.eq('status', query.status);
    if (query.meeting_type) q = q.eq('meeting_type', query.meeting_type);
    if (query.organizer_id) q = q.eq('organizer_id', query.organizer_id);
    if (query.department_id) q = q.eq('department_id', query.department_id);
    if (query.customer_id) q = q.eq('customer_id', query.customer_id);
    if (query.opportunity_id) q = q.eq('opportunity_id', query.opportunity_id);
    if (query.rfq_id) q = q.eq('rfq_id', query.rfq_id);
    if (query.product_id) q = q.eq('product_id', query.product_id);
    if (query.from_date) q = q.gte('meeting_date', query.from_date);
    if (query.to_date) q = q.lte('meeting_date', query.to_date);

    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);

    // Enrich with counts of points and decisions
    const meetingsWithStats = await Promise.all(
      (data || []).map(async (m: any) => {
        const { count: pointCount } = await this.supabase
          .from('meeting_points')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', m.id);

        const { count: pendingActionCount } = await this.supabase
          .from('meeting_points')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', m.id)
          .eq('action_required', true)
          .neq('status', 'RESOLVED');

        const { count: decisionCount } = await this.supabase
          .from('meeting_decisions')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', m.id);

        return {
          ...m,
          stats: {
            pointsCount: pointCount || 0,
            pendingActionCount: pendingActionCount || 0,
            decisionCount: decisionCount || 0,
          }
        };
      })
    );

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

    // 2. Check for recurring series configuration
    let seriesId: string | null = null;
    if (payload.recurrence && payload.recurrence.enabled) {
      const { data: series, error: seriesErr } = await this.supabase
        .from('meeting_series')
        .insert({
          organization_id: this.orgId,
          title: payload.title,
          meeting_type: payload.meeting_type || 'INTERNAL',
          recurrence_type: payload.recurrence.type || 'WEEKLY',
          recurrence_interval: payload.recurrence.interval || 1,
          days_of_week: payload.recurrence.days || [],
          start_date: payload.meeting_date,
          end_date: payload.recurrence.end_date || null,
          total_occurrences: payload.recurrence.total_occurrences || null,
          created_by: this.userId
        })
        .select('*')
        .single();

      if (seriesErr) throw new AppError(seriesErr.message, 500);
      seriesId = series.id;
    }

    // 3. Create meeting record
    const { data: meeting, error: meetErr } = await this.supabase
      .from('meetings')
      .insert({
        organization_id: this.orgId,
        title: payload.title.trim(),
        meeting_date: payload.meeting_date,
        meeting_time: payload.meeting_time || '10:00:00',
        end_time: payload.end_time || null,
        timezone: payload.timezone || 'Asia/Kolkata',
        location_or_link: payload.location_or_link || null,
        meeting_type: payload.meeting_type || 'INTERNAL',
        organizer_id: payload.organizer_id || this.userId,
        department_id: payload.department_id || null,
        customer_id: payload.customer_id || null,
        opportunity_id: payload.opportunity_id || null,
        rfq_id: payload.rfq_id || null,
        product_id: payload.product_id || null,
        molecule_id: payload.molecule_id || null,
        meeting_series_id: seriesId,
        previous_meeting_id: payload.previous_meeting_id || null,
        agenda: payload.agenda || null,
        objective: payload.objective || null,
        expected_outcomes: payload.expected_outcomes || null,
        external_organizations: payload.external_organizations || null,
        notes: payload.notes || null,
        preparation_status: 'PENDING',
        closure_status: 'OPEN',
        status: 'SCHEDULED',
        reminder_preferences: payload.reminder_preferences || {
          upcoming_24h: true,
          upcoming_1h: true,
          upcoming_15m: true,
          preparation_reminder: true,
          closure_reminder: true
        }
      })
      .select('*')
      .single();

    if (meetErr) throw new AppError(meetErr.message, 500);

    // 4. Attach participants
    if (payload.participants && Array.isArray(payload.participants)) {
      const parts = payload.participants.map((p: any) => ({
        meeting_id: meeting.id,
        user_profile_id: typeof p === 'string' ? p : p.user_profile_id,
        role: typeof p === 'object' && p.role ? p.role : 'ATTENDEE',
        attendance_status: 'PENDING'
      }));
      await this.supabase.from('meeting_participants').insert(parts);
    }

    // 5. Schedule default reminders
    await this.scheduleMeetingReminders(meeting.id);

    return meeting;
  }

  async getMeeting(id: string) {
    const { data, error } = await this.supabase
      .from('meetings')
      .select(`
        *,
        organizer:user_profiles!organizer_id(id, first_name, last_name, email),
        department:departments(id, name),
        customer:customers(id, name, customer_code),
        opportunity:opportunities(id, title, opportunity_code, status),
        rfq:rfqs(id, rfq_number, status),
        product:products(id, name, product_code),
        molecule:molecules(id, name),
        series:meeting_series(id, title, recurrence_type, series_code),
        previous_meeting:meetings!previous_meeting_id(id, meeting_code, title, meeting_date),
        participants:meeting_participants(
          id,
          role,
          attendance_status,
          user_profile:user_profiles(id, first_name, last_name, email, department:departments(name))
        )
      `)
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundError('Meeting not found');
    return data;
  }

  async updateMeeting(id: string, payload: any) {
    if (payload.meeting_time && payload.end_time && payload.end_time <= payload.meeting_time) {
      throw new ValidationError('End time must be after start time');
    }

    const { data, error } = await this.supabase
      .from('meetings')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async startMeeting(id: string) {
    const { data, error } = await this.supabase
      .from('meetings')
      .update({
        status: 'IN_PROGRESS',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async endMeeting(id: string) {
    const { data, error } = await this.supabase
      .from('meetings')
      .update({
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
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

    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  async createNote(meetingId: string, payload: any) {
    if (!payload.content || !payload.content.trim()) {
      throw new ValidationError('Note content cannot be empty');
    }

    // Deduplication check via client_mutation_id
    if (payload.client_mutation_id) {
      const { data: existing } = await this.supabase
        .from('meeting_notes')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('client_mutation_id', payload.client_mutation_id)
        .maybeSingle();

      if (existing) return existing;
    }

    const { data, error } = await this.supabase
      .from('meeting_notes')
      .insert({
        organization_id: this.orgId,
        meeting_id: meetingId,
        user_id: this.userId,
        content: payload.content.trim(),
        speaker: payload.speaker || null,
        department_id: payload.department_id || null,
        agenda_item: payload.agenda_item || null,
        note_type: payload.note_type || 'NOTE',
        is_draft: payload.is_draft || false,
        client_mutation_id: payload.client_mutation_id || null
      })
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async updateNote(noteId: string, payload: any) {
    const { data, error } = await this.supabase
      .from('meeting_notes')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async deleteNote(noteId: string) {
    const { error } = await this.supabase
      .from('meeting_notes')
      .delete()
      .eq('organization_id', this.orgId)
      .eq('id', noteId);

    if (error) throw new AppError(error.message, 500);
    return { success: true };
  }

  quickCaptureParse(text: string) {
    return MeetingQuickCaptureService.parseNote(text);
  }

  // ============================================================================
  // 5. STRUCTURED MEETING POINTS & DECISIONS
  // ============================================================================

  async getMeetingPoints(meetingId: string) {
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

    if (error) throw new AppError(error.message, 500);
    return data || [];
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

    const { data, error } = await this.supabase
      .from('meeting_points')
      .insert({
        organization_id: this.orgId,
        meeting_id: meetingId,
        title: payload.title.trim(),
        description: payload.description || null,
        agenda_item: payload.agenda_item || null,
        category: payload.category || 'DISCUSSION',
        priority: payload.priority || 'MEDIUM',
        discussion_notes: payload.discussion_notes || null,
        decision_text: payload.decision_text || null,
        action_required: payload.action_required || false,
        responsible_department_id: deptId,
        responsible_user_id: userId,
        due_date: payload.due_date || null,
        status: payload.status || 'OPEN',
        related_customer_id: payload.related_customer_id || null,
        related_opportunity_id: payload.related_opportunity_id || null,
        related_rfq_id: payload.related_rfq_id || null,
        related_product_id: payload.related_product_id || null,
        source_note_id: payload.source_note_id || null,
        created_by: this.userId
      })
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async updateMeetingPoint(pointId: string, payload: any) {
    const { data, error } = await this.supabase
      .from('meeting_points')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('id', pointId)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  async carryForwardPoint(pointId: string, targetMeetingId: string, reason?: string) {
    // 1. Fetch original point
    const { data: original, error: fetchErr } = await this.supabase
      .from('meeting_points')
      .select('*')
      .eq('organization_id', this.orgId)
      .eq('id', pointId)
      .single();

    if (fetchErr || !original) throw new NotFoundError('Source meeting point not found');

    // 2. Create carried-forward point in target meeting
    const { data: carried, error: createErr } = await this.supabase
      .from('meeting_points')
      .insert({
        organization_id: this.orgId,
        meeting_id: targetMeetingId,
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
        due_date: original.due_date, // Strictly preserves original due date!
        status: 'OPEN',
        related_customer_id: original.related_customer_id,
        related_opportunity_id: original.related_opportunity_id,
        related_rfq_id: original.related_rfq_id,
        related_product_id: original.related_product_id,
        linked_task_id: original.linked_task_id, // Preserves linked task without creating duplicate
        carried_forward_from_id: original.id,
        carry_forward_count: (original.carry_forward_count || 0) + 1,
        created_by: this.userId
      })
      .select('*')
      .single();

    if (createErr) throw new AppError(createErr.message, 500);

    // 3. Mark original as CARRIED_FORWARD
    await this.supabase
      .from('meeting_points')
      .update({
        status: 'CARRIED_FORWARD',
        updated_at: new Date().toISOString()
      })
      .eq('id', original.id);

    return carried;
  }

  async getDecisions(meetingId: string) {
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

    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  async createDecision(meetingId: string, payload: any) {
    if (!payload.title || !payload.title.trim()) {
      throw new ValidationError('Decision title is required');
    }

    const { data, error } = await this.supabase
      .from('meeting_decisions')
      .insert({
        organization_id: this.orgId,
        meeting_id: meetingId,
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
        linked_point_id: payload.linked_point_id || null,
        created_by: this.userId
      })
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  // ============================================================================
  // 6. ACTION ITEM TO TASK CREATION (EXTENDS EXISTING TASK MANAGEMENT)
  // ============================================================================

  async convertPointToTask(pointId: string, payload: any) {
    // 1. Fetch point
    const { data: point, error: ptErr } = await this.supabase
      .from('meeting_points')
      .select('*, meeting:meetings!meeting_id(*)')
      .eq('organization_id', this.orgId)
      .eq('id', pointId)
      .single();

    if (ptErr || !point) throw new NotFoundError('Meeting point not found');

    // Deduplication check: Do not duplicate if task already linked
    if (point.linked_task_id) {
      const { data: existingTask } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', point.linked_task_id)
        .maybeSingle();

      if (existingTask) {
        return existingTask;
      }
    }

    const meeting = point.meeting;
    const dueDate = payload.due_date || point.due_date || new Date().toISOString().split('T')[0];

    // 2. Call existing TaskService.createTask
    const taskPayload = {
      title: payload.title || point.title,
      description: payload.description || point.description || `Action item from meeting ${meeting.meeting_code} - ${meeting.title}`,
      task_type: payload.task_type || 'MEETING_ACTION',
      priority: payload.priority || point.priority || 'MEDIUM',
      source_type: 'MEETING',
      meeting_id: meeting.id,
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
    await this.supabase
      .from('meeting_points')
      .update({
        linked_task_id: task.id,
        action_required: true,
        status: 'ACTION_REQUIRED',
        updated_at: new Date().toISOString()
      })
      .eq('id', point.id);

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
    const { data: updated, error } = await this.supabase
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
      .single();

    if (error) throw new AppError(error.message, 500);

    // Carry forward any points selected in wizard to next meeting if next meeting exists
    if (closureData.carry_forward_points && Array.isArray(closureData.carry_forward_points) && closureData.next_meeting_id) {
      for (const ptId of closureData.carry_forward_points) {
        await this.carryForwardPoint(ptId, closureData.next_meeting_id, 'Carried forward during closure wizard');
      }
    }

    return updated;
  }

  // ============================================================================
  // 8. MEETING MINUTES EXPORT & EXCEL WORKBOOK
  // ============================================================================

  async exportMinutesWorkbook(meetingId: string) {
    const meeting = await this.getMeeting(meetingId);
    const points = await this.getMeetingPoints(meetingId);
    const decisions = await this.getDecisions(meetingId);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['BDIQ Enterprise Meeting Minutes'],
      ['Meeting Code', meeting.meeting_code],
      ['Meeting Title', meeting.title],
      ['Date', meeting.meeting_date],
      ['Time', meeting.meeting_time || 'N/A'],
      ['Location / Link', meeting.location_or_link || 'N/A'],
      ['Type', meeting.meeting_type],
      ['Organizer', meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'N/A'],
      ['Customer', meeting.customer ? meeting.customer.name : 'Internal'],
      ['Opportunity', meeting.opportunity ? meeting.opportunity.title : 'N/A'],
      ['RFQ', meeting.rfq ? meeting.rfq.rfq_number : 'N/A'],
      ['Product', meeting.product ? meeting.product.name : 'N/A'],
      ['Status', meeting.status],
      ['Closure Status', meeting.closure_status],
      ['Objective', meeting.objective || 'N/A'],
      ['Expected Outcomes', meeting.expected_outcomes || 'N/A'],
      ['Closure Summary', meeting.closure_summary || 'N/A']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Decisions
    const decisionHeaders = ['Decision Code', 'Title', 'Date', 'Owner', 'Impact', 'Rationale', 'Evidence'];
    const decisionRows = decisions.map((d: any) => [
      d.decision_code,
      d.title,
      d.decision_date,
      d.decision_owner ? `${d.decision_owner.first_name} ${d.decision_owner.last_name}` : 'N/A',
      d.impact,
      d.rationale || '',
      d.evidence || ''
    ]);
    const wsDecisions = XLSX.utils.aoa_to_sheet([decisionHeaders, ...decisionRows]);
    XLSX.utils.book_append_sheet(wb, wsDecisions, 'Decisions');

    // Sheet 3: Points & Actions
    const pointHeaders = [
      'Point Code',
      'Title',
      'Category',
      'Priority',
      'Action Required',
      'Responsible Dept',
      'Responsible Person',
      'Due Date',
      'Status',
      'Linked Task Code'
    ];
    const pointRows = points.map((p: any) => [
      p.point_code,
      p.title,
      p.category,
      p.priority,
      p.action_required ? 'YES' : 'NO',
      p.responsible_department ? p.responsible_department.name : '',
      p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : '',
      p.due_date || '',
      p.status,
      p.linked_task ? p.linked_task.task_code : ''
    ]);
    const wsPoints = XLSX.utils.aoa_to_sheet([pointHeaders, ...pointRows]);
    XLSX.utils.book_append_sheet(wb, wsPoints, 'Points & Actions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ============================================================================
  // 9. REMINDERS ENGINE & DEDUPLICATION
  // ============================================================================

  async scheduleMeetingReminders(meetingId: string) {
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
  }

  // ============================================================================
  // 10. CONFIGURATION & TEMPLATES MANAGEMENT
  // ============================================================================

  async getConfigurations() {
    const { data, error } = await this.supabase
      .from('meeting_configurations')
      .select('*')
      .eq('organization_id', this.orgId)
      .order('config_name', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  async updateConfiguration(configKey: string, newValue: any, changeReason: string) {
    const { data: current } = await this.supabase
      .from('meeting_configurations')
      .select('*')
      .eq('organization_id', this.orgId)
      .eq('config_key', configKey)
      .single();

    if (!current) throw new NotFoundError('Configuration not found');

    // 1. Audit in history
    await this.supabase
      .from('meeting_configuration_history')
      .insert({
        organization_id: this.orgId,
        config_id: current.id,
        config_key: configKey,
        version: current.version,
        previous_value: current.config_value,
        new_value: newValue,
        change_reason: changeReason || 'Administrative update',
        changed_by: this.userId
      });

    // 2. Update config
    const { data: updated, error } = await this.supabase
      .from('meeting_configurations')
      .update({
        config_value: newValue,
        version: current.version + 1,
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', this.orgId)
      .eq('config_key', configKey)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated;
  }

  async listTemplates() {
    const { data, error } = await this.supabase
      .from('meeting_templates')
      .select('*')
      .eq('organization_id', this.orgId)
      .eq('is_active', true)
      .order('template_name', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  async createTemplate(payload: any) {
    if (!payload.template_name || !payload.meeting_type) {
      throw new ValidationError('Template name and meeting type are required');
    }

    const { data, error } = await this.supabase
      .from('meeting_templates')
      .insert({
        organization_id: this.orgId,
        template_name: payload.template_name.trim(),
        meeting_type: payload.meeting_type,
        description: payload.description || null,
        default_agenda: payload.default_agenda || [],
        default_categories: payload.default_categories || [],
        default_duration_minutes: payload.default_duration_minutes || 60,
        required_fields: payload.required_fields || [],
        created_by: this.userId
      })
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }
}
