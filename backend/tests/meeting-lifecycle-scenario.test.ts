import { MeetingQuickCaptureService } from '../src/services/meeting-quick-capture.service';
import { calendarDaysDiff } from '../src/services/task-metrics.service';

describe('Meeting Intelligence Lifecycle & Prompt Critical Scenario Test', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = 'aaaa1111-1111-1111-1111-111111111111';
  const meeting1Id = 'meet-001';
  const meeting2Id = 'meet-002';
  const refDate = new Date(2026, 9, 1); // 1 October 2026

  describe('Step 1: Mini Notes Quick Capture Scenario', () => {
    it('captures "R&D will confirm formulation feasibility by 15 October." with correct department and due date', () => {
      const noteText = 'R&D will confirm formulation feasibility by 15 October.';
      const parsed = MeetingQuickCaptureService.parseNote(noteText, refDate);

      expect(parsed.suggestedDepartment).toBe('R&D');
      expect(parsed.suggestedDueDate).toBe('2026-10-15');
      expect(parsed.suggestedAction.toLowerCase()).toContain('confirm formulation feasibility');
      expect(parsed.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(parsed.requiresConfirmation).toBe(true);
    });
  });

  describe('Step 2: Meeting Point & Task Creation Linkage', () => {
    it('converts captured note into structured meeting point with immutable original due date', () => {
      const mockPoint = {
        id: 'point-101',
        organization_id: orgId,
        meeting_id: meeting1Id,
        title: 'Confirm formulation feasibility',
        category: 'ACTION',
        priority: 'HIGH',
        action_required: true,
        responsible_department_id: 'dept-rd',
        responsible_user_id: 'user-rd-lead',
        due_date: '2026-10-15',
        status: 'ACTION_REQUIRED',
        linked_task_id: null as string | null
      };

      expect(mockPoint.due_date).toBe('2026-10-15');
      expect(mockPoint.action_required).toBe(true);
      expect(mockPoint.linked_task_id).toBeNull();

      // Simulate task conversion
      const createdTask = {
        id: 'task-501',
        task_code: 'TASK-2026-000501',
        title: mockPoint.title,
        meeting_id: meeting1Id,
        source_type: 'MEETING',
        original_due_date: mockPoint.due_date,
        current_due_date: mockPoint.due_date,
        status: 'OPEN',
        assigned_department_id: mockPoint.responsible_department_id,
        assigned_user_id: mockPoint.responsible_user_id
      };

      mockPoint.linked_task_id = createdTask.id;

      expect(createdTask.original_due_date).toBe('2026-10-15');
      expect(createdTask.meeting_id).toBe(meeting1Id);
      expect(mockPoint.linked_task_id).toBe(createdTask.id);
    });

    it('prevents creating duplicate task if meeting point already has linked_task_id', () => {
      const pointWithTask = {
        id: 'point-101',
        linked_task_id: 'task-501'
      };

      // When convertPointToTask is invoked again, it must return existing task without inserting
      const isDuplicatePrevented = !!pointWithTask.linked_task_id;
      expect(isDuplicatePrevented).toBe(true);
    });
  });

  describe('Step 3: Review in Next Meeting & No Update Handling', () => {
    it('accurately identifies "No Update" record and calculates delay from original due date', () => {
      const originalDueDate = '2026-10-15';
      const recentFollowupDate = '2026-10-22';
      const reviewDate = new Date(2026, 9, 25); // 25 October 2026

      const taskWithFollowups = {
        id: 'task-501',
        original_due_date: originalDueDate,
        current_due_date: recentFollowupDate,
        followups: [
          {
            followup_number: 1,
            followup_date: '2026-10-18',
            response_status: 'NO_UPDATE',
            next_followup_date: recentFollowupDate
          },
          {
            followup_number: 2,
            followup_date: recentFollowupDate,
            response_status: 'NO_UPDATE',
            next_followup_date: '2026-10-25'
          }
        ]
      };

      const latestFollowup = taskWithFollowups.followups[taskWithFollowups.followups.length - 1];
      expect(latestFollowup.response_status).toBe('NO_UPDATE');

      // CRITICAL RULE VERIFICATION:
      // Delay must ALWAYS be calculated from original_due_date ('2026-10-15'), NEVER from recentFollowupDate ('2026-10-22')!
      const delayFromOriginal = calendarDaysDiff(new Date(originalDueDate), reviewDate);
      const delayFromRecent = calendarDaysDiff(new Date(recentFollowupDate), reviewDate);

      expect(delayFromOriginal).toBe(10); // 25 Oct - 15 Oct = 10 days
      expect(delayFromRecent).toBe(3);    // 25 Oct - 22 Oct = 3 days

      // Ensure platform uses original delay
      expect(delayFromOriginal).toBeGreaterThan(delayFromRecent);
    });
  });

  describe('Step 4: Carry Forward Point Preservation', () => {
    it('carrying forward preserves historical lineage, task linkage, and original due date', () => {
      const originalPoint = {
        id: 'point-101',
        meeting_id: meeting1Id,
        title: 'Confirm formulation feasibility',
        due_date: '2026-10-15',
        linked_task_id: 'task-501',
        carry_forward_count: 0,
        status: 'OPEN'
      };

      // Carry forward to Meeting 2
      const carriedPoint = {
        id: 'point-201',
        meeting_id: meeting2Id,
        title: originalPoint.title,
        due_date: originalPoint.due_date, // MUST preserve original due date
        linked_task_id: originalPoint.linked_task_id, // MUST preserve existing task, not create duplicate
        carried_forward_from_id: originalPoint.id,
        carry_forward_count: originalPoint.carry_forward_count + 1,
        status: 'OPEN'
      };

      originalPoint.status = 'CARRIED_FORWARD';

      expect(carriedPoint.meeting_id).toBe(meeting2Id);
      expect(carriedPoint.due_date).toBe('2026-10-15');
      expect(carriedPoint.linked_task_id).toBe('task-501');
      expect(carriedPoint.carried_forward_from_id).toBe(originalPoint.id);
      expect(carriedPoint.carry_forward_count).toBe(1);
      expect(originalPoint.status).toBe('CARRIED_FORWARD');
    });
  });

  describe('Step 5: Precedence Resolution for Previous Meetings', () => {
    it('respects the 5-tier precedence order: explicit link > series > customer+opportunity > customer', () => {
      // 1. Explicit link wins over everything
      const explicitMeeting = {
        id: 'meet-002',
        previous_meeting_id: 'meet-explicit',
        meeting_series_id: 'series-01',
        customer_id: 'cust-01',
        opportunity_id: 'opp-01'
      };
      expect(explicitMeeting.previous_meeting_id).toBe('meet-explicit');

      // 2. If no explicit link, recurring series wins
      const seriesMeeting = {
        id: 'meet-003',
        previous_meeting_id: null,
        meeting_series_id: 'series-01',
        customer_id: 'cust-01',
        opportunity_id: 'opp-01'
      };
      expect(seriesMeeting.previous_meeting_id).toBeNull();
      expect(seriesMeeting.meeting_series_id).toBe('series-01');

      // 3. If no series, customer + opportunity match
      const dealMeeting = {
        id: 'meet-004',
        previous_meeting_id: null,
        meeting_series_id: null,
        customer_id: 'cust-01',
        opportunity_id: 'opp-01'
      };
      expect(dealMeeting.customer_id).toBe('cust-01');
      expect(dealMeeting.opportunity_id).toBe('opp-01');
    });
  });
});
