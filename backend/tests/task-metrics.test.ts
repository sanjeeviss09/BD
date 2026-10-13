import { TaskMetricsService, parseDateOnly, calendarDaysDiff } from '../src/services/task-metrics.service';

describe('Task Metrics & Delay Calculation Suite', () => {
  describe('Full Business Scenario 1: Oct 5 -> Oct 8 -> Oct 10 -> Oct 11', () => {
    const originalDueDate = '2026-10-05';
    const createdAt = '2026-10-01';

    it('Scenario Step 1: Initial creation with Oct 5 commitment', () => {
      const task = {
        original_due_date: originalDueDate,
        current_due_date: originalDueDate,
        created_at: createdAt,
        status: 'OPEN',
      };

      const oct5 = new Date(2026, 9, 5);
      const m1 = TaskMetricsService.calculateMetrics(task, [], oct5);

      expect(m1.originalDelayDays).toBe(0);
      expect(m1.currentDelayDays).toBe(0);
      expect(m1.isOverdue).toBe(false);
      expect(m1.followupCount).toBe(0);
      expect(m1.waitingDays).toBe(4);
    });

    it('Scenario Step 2: First No Update on Oct 5 setting next follow-up to Oct 8', () => {
      const followups = [
        {
          followup_number: 1,
          followup_date: '2026-10-05',
          response_status: 'NO_UPDATE',
          next_followup_date: '2026-10-08',
          remarks: 'Awaiting laboratory batch certificate',
        },
      ];

      const taskAfterNoUpdate1 = {
        original_due_date: originalDueDate,
        current_due_date: '2026-10-08',
        created_at: createdAt,
        status: 'WAITING_FOR_UPDATE',
      };

      const oct8 = new Date(2026, 9, 8);
      const m2 = TaskMetricsService.calculateMetrics(taskAfterNoUpdate1, followups, oct8);

      expect(m2.originalDelayDays).toBe(3); // Oct 8 - Oct 5 = 3 days
      expect(m2.currentDelayDays).toBe(0); // Due today
      expect(m2.followupCount).toBe(1);
    });

    it('Scenario Step 3: Second No Update on Oct 8 setting next follow-up to Oct 10', () => {
      const followups = [
        {
          followup_number: 1,
          followup_date: '2026-10-05',
          response_status: 'NO_UPDATE',
          next_followup_date: '2026-10-08',
        },
        {
          followup_number: 2,
          followup_date: '2026-10-08',
          response_status: 'NO_UPDATE',
          next_followup_date: '2026-10-10',
        },
      ];

      const taskAfterNoUpdate2 = {
        original_due_date: originalDueDate,
        current_due_date: '2026-10-10',
        created_at: createdAt,
        status: 'WAITING_FOR_UPDATE',
      };

      const oct10 = new Date(2026, 9, 10);
      const m3 = TaskMetricsService.calculateMetrics(taskAfterNoUpdate2, followups, oct10);

      expect(m3.originalDelayDays).toBe(5); // Oct 10 - Oct 5 = 5 days
      expect(m3.followupCount).toBe(2);
    });

    it('Scenario Step 4: Final response received and completed on Oct 11 -> exactly 6 calendar days delay', () => {
      const followups = [
        {
          followup_number: 1,
          followup_date: '2026-10-05',
          response_status: 'NO_UPDATE',
          next_followup_date: '2026-10-08',
        },
        {
          followup_number: 2,
          followup_date: '2026-10-08',
          response_status: 'NO_UPDATE',
          next_followup_date: '2026-10-10',
        },
        {
          followup_number: 3,
          followup_date: '2026-10-11',
          response_status: 'UPDATE_RECEIVED',
          response_received: true,
          response_received_date: '2026-10-11',
          response_summary: 'Batch certificate delivered and verified',
        },
      ];

      const completedTask = {
        original_due_date: originalDueDate,
        current_due_date: '2026-10-10',
        created_at: createdAt,
        status: 'COMPLETED',
        completed_at: '2026-10-11T14:30:00Z',
      };

      const mFinal = TaskMetricsService.calculateMetrics(completedTask, followups);

      expect(mFinal.originalDelayDays).toBe(6);
      expect(mFinal.responseDelayDays).toBe(6);
      expect(mFinal.isOverdue).toBe(false);
      expect(mFinal.followupCount).toBe(3);
      expect(mFinal.resolutionTimeDays).toBe(10); // Oct 1 to Oct 11 = 10 days
    });
  });

  describe('Business Scenario 2: Partial Updates Before Completion', () => {
    it('preserves history and calculates final response time from original due date', () => {
      const originalDueDate = '2026-10-01';
      const createdAt = '2026-09-25';

      const followups = [
        {
          followup_number: 1,
          followup_date: '2026-10-01',
          response_status: 'PARTIAL_UPDATE',
          response_received: true,
          response_received_date: '2026-10-01',
          response_summary: 'Received Module 1; pending Module 2',
          next_followup_date: '2026-10-05',
        },
        {
          followup_number: 2,
          followup_date: '2026-10-05',
          response_status: 'PARTIAL_UPDATE',
          response_received: true,
          response_received_date: '2026-10-05',
          response_summary: 'Received Module 2.1; pending clinical overview',
          next_followup_date: '2026-10-08',
        },
        {
          followup_number: 3,
          followup_date: '2026-10-08',
          response_status: 'UPDATE_RECEIVED',
          response_received: true,
          response_received_date: '2026-10-08',
          response_summary: 'All dossier modules completed',
        },
      ];

      const completedTask = {
        original_due_date: originalDueDate,
        current_due_date: '2026-10-08',
        created_at: createdAt,
        status: 'COMPLETED',
        completed_at: '2026-10-08T10:00:00Z',
      };

      const metrics = TaskMetricsService.calculateMetrics(completedTask, followups);

      // Oct 8 minus Oct 1 = 7 calendar days delay
      expect(metrics.originalDelayDays).toBe(7);
      expect(metrics.responseDelayDays).toBe(7);
      expect(metrics.followupCount).toBe(3);
    });
  });

  describe('Business Scenario 3: Task Placed on Hold for Approved Period', () => {
    it('preserves gross elapsed time while correctly deducting hold duration from active delay', () => {
      const originalDueDate = '2026-10-01';
      const createdAt = '2026-09-20';

      const taskWithHold = {
        original_due_date: originalDueDate,
        current_due_date: '2026-10-15',
        created_at: createdAt,
        status: 'IN_PROGRESS',
        total_hold_duration_days: 5, // Approved 5 days hold
      };

      // As of Oct 10: Gross delay past Oct 1 is 9 days
      const oct10 = new Date(2026, 9, 10);
      const metrics = TaskMetricsService.calculateMetrics(taskWithHold, [], oct10);

      expect(metrics.originalDelayDays).toBe(9); // Gross delay = 9 days
      expect(metrics.activeDelayDays).toBe(4); // Active delay = 9 - 5 = 4 days!
    });
  });

  describe('Calendar Date Math Edge Cases', () => {
    it('accurately parses dates without timezone shifts', () => {
      const d = parseDateOnly('2026-10-05');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(9);
      expect(d!.getDate()).toBe(5);
    });

    it('correctly calculates difference across month boundaries', () => {
      const d1 = new Date(2026, 8, 28);
      const d2 = new Date(2026, 9, 3);
      expect(calendarDaysDiff(d1, d2)).toBe(5);
    });
  });
});
