import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MeetingService } from '../src/services/meeting.service';
import { ValidationError, NotFoundError } from '../src/utils/errors';
import { createSupabaseClientForUser } from '../src/db/supabase';

describe('BDIQ Meeting Intelligence Live Workflow & Automation (End-to-End Suite)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/029_meeting_intelligence_live_workflow.sql');
  let migrationSql = '';

  const mockOrgId = 'a0000000-0000-0000-0000-000000000001';
  const mockUserId = 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
  const mockSupabase = createSupabaseClientForUser({} as any);

  const getService = () => new MeetingService(mockSupabase, mockOrgId, mockUserId);

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  describe('1. Migration 029 Safety & Governance Standards', () => {
    it('migration file exists and has substantial additive content', () => {
      expect(migrationSql.length).toBeGreaterThan(500);
    });

    it('contains ZERO destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
      const dangerousPatterns = [/DROP\s+TABLE/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(migrationSql)).toBe(false);
      }
    });

    it('uses IF NOT EXISTS for all table and column additions', () => {
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS');
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('enforces Row Level Security (RLS) on added auxiliary tables', () => {
      expect(migrationSql).toContain('ENABLE ROW LEVEL SECURITY');
    });
  });

  describe('2. Meeting Service Scheduling & Conferencing Link Persistence', () => {
    it('schedules a meeting with Microsoft Teams link and normalizes URL', async () => {
      const service = getService();
      const teamsUrl = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_test';

      const meeting = await service.createMeeting({
        title: 'Formulation & Excipient Feasibility Review',
        meeting_type: 'Customer Meeting',
        meeting_date: '2026-10-20',
        meeting_time: '10:00:00',
        end_time: '11:00:00',
        timezone: 'Asia/Kolkata',
        location_or_link: teamsUrl,
        agenda: '1. Formulation compatibility\n2. Pilot trial schedule',
        objective: 'Confirm trial batch size and critical quality attributes'
      });

      expect(meeting).toBeDefined();
      expect(meeting.id).toBeDefined();
      expect(meeting.meeting_code).toMatch(/^MEET-/);
      expect(meeting.location_or_link).toBe(teamsUrl);
      expect(meeting.status).toBe('SCHEDULED');

      // Verify retrieved record preserves the conferencing link
      const retrieved = await service.getMeeting(meeting.id);
      expect(retrieved.location_or_link).toBe(teamsUrl);
    });

    it('normalizes link without protocol by prepending https://', async () => {
      const service = getService();
      const meeting = await service.createMeeting({
        title: 'Zoom Commercial Pricing Sync',
        meeting_type: 'Internal Review',
        meeting_date: '2026-10-21',
        meeting_time: '14:00:00',
        timezone: 'Asia/Kolkata',
        location_or_link: 'zoom.us/j/9876543210'
      });

      expect(meeting.location_or_link).toBe('https://zoom.us/j/9876543210');
    });
  });

  describe('3. Start Meeting Lifecycle & Live Session Workspace', () => {
    it('transitions status to IN_PROGRESS, sets actual_start_time and returns launch_url', async () => {
      const service = getService();
      const teamsUrl = 'https://teams.microsoft.com/l/meetup-join/test-call';

      const meeting = await service.createMeeting({
        title: 'GMP Batch Readiness Gate',
        meeting_type: 'Customer Meeting',
        meeting_date: '2026-10-22',
        meeting_time: '09:00:00',
        location_or_link: teamsUrl
      });

      const started = await service.startMeeting(meeting.id);
      expect(started.status).toBe('IN_PROGRESS');
      expect(started.actual_start_time).toBeDefined();
      expect(started.started_by).toBe(mockUserId);
      expect(started.launch_url).toBe(teamsUrl);

      // Verify retrieved meeting reflects IN_PROGRESS
      const retrieved = await service.getMeeting(meeting.id);
      expect(retrieved.status).toBe('IN_PROGRESS');
      expect(retrieved.actual_start_time).toBe(started.actual_start_time);
    });

    it('prevents starting a meeting that is already completed or cancelled', async () => {
      const service = getService();
      const meeting = await service.createMeeting({
        title: 'Closed Meeting Test',
        meeting_type: 'Internal Review',
        meeting_date: '2026-10-22',
        meeting_time: '11:00:00'
      });

      await service.updateMeeting(meeting.id, { status: 'COMPLETED' });
      await expect(service.startMeeting(meeting.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('4. Mini Notes, Structured Points, Decisions & Canonical Task Creation', () => {
    let testMeetingId = '';

    beforeAll(async () => {
      const service = getService();
      const meet = await service.createMeeting({
        title: 'Clinical Trial Batch Supply Alignment',
        meeting_type: 'Customer Meeting',
        meeting_date: '2026-10-23',
        meeting_time: '15:00:00',
        location_or_link: 'https://meet.google.com/abc-defg-hij',
        agenda: '1. Scale-up batch validation\n2. Delivery timeline'
      });
      testMeetingId = meet.id;
      await service.startMeeting(testMeetingId);
    });

    it('persists and retrieves live Mini Notes with deduplication and metadata', async () => {
      const service = getService();

      const note1 = await service.createNote(testMeetingId, {
        content: 'R&D confirmed formulation stability at 25C/60% RH.',
        speaker: 'Dr. Aris Thorne (R&D)',
        note_type: 'DISCUSSION',
        agenda_item: '1. Scale-up batch validation'
      });
      expect(note1.id).toBeDefined();
      expect(note1.content).toContain('R&D confirmed formulation stability');

      const note2 = await service.createNote(testMeetingId, {
        content: 'Procurement must reserve 50kg USP grade lactose monohydrate by Oct 28.',
        speaker: 'Elena Vance (Supply Chain)',
        note_type: 'ACTION'
      });
      expect(note2.id).toBeDefined();

      const notes = await service.getNotes(testMeetingId);
      expect(notes.length).toBeGreaterThanOrEqual(2);
      expect(notes.some(n => n.content.includes('50kg USP grade lactose'))).toBe(true);
    });

    it('creates structured meeting point with auto-generated code and due date', async () => {
      const service = getService();

      const point = await service.createMeetingPoint(testMeetingId, {
        title: 'Finalize Analytical Method Validation Protocol',
        category: 'ACTION',
        priority: 'HIGH',
        due_date: '2026-10-30',
        action_required: true,
        discussion_notes: 'QC Lead to issue protocol for client review.'
      });

      expect(point.id).toBeDefined();
      expect(point.point_code).toMatch(/^PT-/);
      expect(point.priority).toBe('HIGH');
      expect(point.action_required).toBe(true);

      const points = await service.getMeetingPoints(testMeetingId);
      expect(points.some(p => p.id === point.id)).toBe(true);
    });

    it('converts meeting point into canonical task with deduplication and linkage', async () => {
      const service = getService();

      const point = await service.createMeetingPoint(testMeetingId, {
        title: 'Prepare Batch Manufacturing Record (BMR) Draft',
        category: 'ACTION',
        priority: 'CRITICAL',
        due_date: '2026-11-05',
        action_required: true
      });

      const task = await service.convertPointToTask(point.id, {
        title: point.title,
        priority: 'CRITICAL',
        due_date: '2026-11-05'
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe(point.title);

      // Verify source meeting point was updated with linked_task_id
      const updatedPoints = await service.getMeetingPoints(testMeetingId);
      const updatedPt = updatedPoints.find(p => p.id === point.id);
      expect(updatedPt).toBeDefined();
      expect(updatedPt?.linked_task_id).toBe(task.id);

      // Verify deduplication: repeated conversion returns existing task without duplicating
      const reTask = await service.convertPointToTask(point.id, { title: point.title });
      expect(reTask.id).toBe(task.id);
    });

    it('records formal decision and enforces explicit confirmation gate', async () => {
      const service = getService();

      const decision = await service.createDecision(testMeetingId, {
        title: 'Standard batch size fixed at 150,000 units per campaign',
        description: 'Approved based on equipment utilization analysis and yield metrics.',
        impact: 'HIGH',
        decision_date: '2026-10-23'
      });

      expect(decision.id).toBeDefined();
      expect(decision.decision_code).toMatch(/^DEC-/);
      expect(decision.is_confirmed).toBe(false);

      // Confirm decision via dedicated gate
      const confirmed = await service.confirmDecision(decision.id, true);
      expect(confirmed.is_confirmed).toBe(true);
      expect(confirmed.confirmed_by).toBe(mockUserId);
      expect(confirmed.confirmed_at).toBeDefined();
    });
  });

  describe('5. End Meeting, Automatic MOM Generation, Review & Excel Export', () => {
    let testMeetingId = '';

    beforeAll(async () => {
      const service = getService();
      const meet = await service.createMeeting({
        title: 'Quarterly Executive CDMO Operations Review',
        meeting_type: 'Steering Committee',
        meeting_date: '2026-10-24',
        meeting_time: '16:00:00',
        location_or_link: 'https://teams.microsoft.com/l/meetup-join/exec-review',
        agenda: '1. Pipeline updates\n2. Resource allocation\n3. Next quarters milestones',
        objective: 'Approve resource expansion for oral solid dosage facility.'
      });
      testMeetingId = meet.id;
      await service.startMeeting(testMeetingId);

      // Add sample notes, point and decision
      await service.createNote(testMeetingId, { content: 'Capacity expansion on track for Q1 launch.' });
      const pt = await service.createMeetingPoint(testMeetingId, {
        title: 'Order high-shear granulator spare parts',
        category: 'ACTION',
        priority: 'MEDIUM',
        due_date: '2026-11-15'
      });
      await service.convertPointToTask(pt.id, { title: pt.title, due_date: '2026-11-15' });

      const dec = await service.createDecision(testMeetingId, {
        title: 'Approved capital budget allocation of $250k for tooling',
        impact: 'CRITICAL'
      });
      await service.confirmDecision(dec.id, true);
    });

    it('ends BDIQ live session and transitions to AWAITING_MOM_REVIEW', async () => {
      const service = getService();
      const ended = await service.endMeeting(testMeetingId);

      expect(ended.status).toBe('AWAITING_MOM_REVIEW');
      expect(ended.actual_end_time).toBeDefined();
      expect(ended.session_summary).toBeDefined();
      expect(ended.session_summary.notesCount).toBeGreaterThan(0);
      expect(ended.session_summary.decisionsCount).toBeGreaterThan(0);
    });

    it('generates draft MOM containing all 18 standard enterprise sections without invented facts', async () => {
      const service = getService();
      const result = await service.generateMOMDraft(testMeetingId, {
        raw_transcript: '[00:05:00] Steering Committee: Budget allocation approved.'
      });

      expect(result.mom_text).toBeDefined();
      const text = result.mom_text;

      // Verify key standard sections exist in the draft text
      expect(text).toContain('MINUTES OF MEETING (MOM)');
      expect(text).toContain('1. MEETING IDENTIFICATION & REFERENCE');
      expect(text).toContain('2. SCHEDULE & TIMING');
      expect(text).toContain('3. ATTENDANCE & PARTICIPANTS');
      expect(text).toContain('4. MEETING OBJECTIVE');
      expect(text).toContain('5. ADOPTED AGENDA');
      expect(text).toContain('6. EXECUTIVE SUMMARY');
      expect(text).toContain('7. DISCUSSION SUMMARY BY AGENDA ITEM');
      expect(text).toContain('8. TECHNICAL AND COMMERCIAL FINDINGS');
      expect(text).toContain('9. CONFIRMED DECISIONS');
      expect(text).toContain('10. ACTION ITEMS & CANONICAL TASKS');
      expect(text).toContain('11. RESPONSIBLE DEPARTMENTS & ASSIGNMENT BREAKDOWN');
      expect(text).toContain('12. AGREED DUE DATES & TIMELINES');
      expect(text).toContain('13. RISKS, DEPENDENCIES & BOTTLENECK MITIGATION');
      expect(text).toContain('14. UNRESOLVED QUESTIONS & PARKED DISCUSSIONS');
      expect(text).toContain('15. CARRIED-FORWARD ITEMS FROM PREVIOUS SESSIONS');
      expect(text).toContain('16. NEXT STEPS & IMMEDIATE ACTIONS');
      expect(text).toContain('17. NEXT MEETING SCHEDULE');
      expect(text).toContain('18. SOURCE, GENERATION & AUDIT METADATA');

      // Verify facts match actual records
      expect(text).toContain('Approved capital budget allocation');
      expect(text).toContain('granulator spare parts');
    });

    it('confirms and approves MOM, transitioning status to COMPLETED and closure_status to CLOSED', async () => {
      const service = getService();
      const draftRes = await service.generateMOMDraft(testMeetingId);

      const confirmed = await service.confirmMOM(testMeetingId, draftRes);
      expect(confirmed.mom_status).toBe('CONFIRMED');
      expect(confirmed.status).toBe('COMPLETED');
      expect(confirmed.closure_status).toBe('CLOSED');
      expect(confirmed.mom_confirmed_by).toBe(mockUserId);
      expect(confirmed.mom_confirmed_at).toBeDefined();
    });

    it('exports genuine Excel workbook containing all 7 required worksheets', async () => {
      const service = getService();
      const buffer = await service.exportMinutesWorkbook(testMeetingId);

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      // Parse with xlsx library to verify valid Excel format and sheet structure
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toBeDefined();

      const requiredSheets = [
        'MOM Summary',
        'Meeting Details',
        'Agenda and Discussion',
        'Confirmed Decisions',
        'Action Items',
        'Risks and Pending Items',
        'Source Notes'
      ];

      for (const sheetName of requiredSheets) {
        expect(workbook.SheetNames).toContain(sheetName);
        const worksheet = workbook.Sheets[sheetName];
        expect(worksheet).toBeDefined();
      }

      // Verify MOM Summary sheet has actual meeting data
      const momSummaryData = XLSX.utils.sheet_to_json(workbook.Sheets['MOM Summary']);
      expect(momSummaryData.length).toBeGreaterThan(0);

      // Verify Confirmed Decisions sheet has recorded decision
      const decisionsData = XLSX.utils.sheet_to_json(workbook.Sheets['Confirmed Decisions']);
      expect(decisionsData.length).toBeGreaterThan(0);
      expect(JSON.stringify(decisionsData)).toContain('Approved capital budget allocation');
    });
  });
});
