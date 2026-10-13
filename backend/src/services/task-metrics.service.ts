import { SupabaseClient } from '@supabase/supabase-js';

export interface TaskMetrics {
  /** Days delayed against the immutable original due date */
  originalDelayDays: number;
  /** Days delayed against the current / latest promised follow-up date */
  currentDelayDays: number;
  /** Total delay when resolved / completed against the original due date */
  responseDelayDays: number | null;
  /** Active delay excluding approved hold duration where applicable */
  activeDelayDays: number;
  /** Total calendar days elapsed since task creation */
  waitingDays: number;
  /** Total calendar days from creation to completion */
  resolutionTimeDays: number | null;
  /** Total count of follow-ups executed */
  followupCount: number;
  /** Whether the task is currently past its current_due_date */
  isOverdue: boolean;
  /** Current SLA adherence status */
  slaStatus: 'OK' | 'WARNING' | 'BREACHED';
}

/**
 * Parses date-only string (YYYY-MM-DD) or Date cleanly into local midnight Date
 */
export function parseDateOnly(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const datePart = d.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  }
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Calculates whole calendar days between two dates (d2 - d1).
 */
export function calendarDaysDiff(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export class TaskMetricsService {
  /**
   * Authoritative source of delay & SLA calculations across the BDIQ platform.
   *
   * Formats & Formulas:
   * 1. Waiting Days = max(0, today - created_at)
   * 2. Overdue Check:
   *    - For pending tasks: today > current_due_date
   * 3. Current Delay Days:
   *    - For pending tasks: max(0, today - current_due_date)
   * 4. Original Delay Days:
   *    - For completed tasks: max(0, completed_at - original_due_date)
   *    - For pending tasks: max(0, today - original_due_date)
   * 5. Active Delay Days:
   *    - max(0, originalDelayDays - total_hold_duration_days)
   * 6. Response Delay Days:
   *    - When resolved or completed: max(0, actual_response_date/completed_at - original_due_date)
   *    - Example: original = Oct 5, response = Oct 11 -> responseDelay = 6 calendar days.
   * 7. Resolution Time:
   *    - For completed tasks: max(0, completed_at - created_at)
   * 8. SLA Status:
   *    - 'BREACHED' if currentDelayDays > 0 or (sla_days && originalDelayDays > sla_days)
   *    - 'WARNING' if today == current_due_date
   *    - 'OK' otherwise
   */
  static calculateMetrics(task: any, followups: any[] = [], asOfDate?: Date): TaskMetrics {
    const today = asOfDate ? new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate()) : new Date();
    today.setHours(0, 0, 0, 0);

    const origDate = parseDateOnly(task.original_due_date) || today;
    const currDate = parseDateOnly(task.current_due_date) || origDate;
    const createdAt = parseDateOnly(task.created_at) || today;
    const holdDays = Number(task.total_hold_duration_days) || 0;

    // 1. Waiting Days
    const waitingDays = Math.max(0, calendarDaysDiff(createdAt, today));

    let originalDelayDays = 0;
    let currentDelayDays = 0;
    let responseDelayDays: number | null = null;
    let resolutionTimeDays: number | null = null;
    let isOverdue = false;

    if (task.completed_at) {
      // Completed task: Metrics are locked to completion timestamp
      const completedDate = parseDateOnly(task.completed_at) || today;
      originalDelayDays = Math.max(0, calendarDaysDiff(origDate, completedDate));
      responseDelayDays = originalDelayDays;
      currentDelayDays = Math.max(0, calendarDaysDiff(currDate, completedDate));
      resolutionTimeDays = Math.max(0, calendarDaysDiff(createdAt, completedDate));
      isOverdue = false;
    } else if (task.status !== 'CANCELLED') {
      // Pending / Active task
      const diffOrig = calendarDaysDiff(origDate, today);
      const diffCurr = calendarDaysDiff(currDate, today);

      originalDelayDays = Math.max(0, diffOrig);
      currentDelayDays = Math.max(0, diffCurr);
      isOverdue = diffCurr > 0 && task.status !== 'ON_HOLD';

      // Check if any follow-up marked response received
      const finalFollowupWithResponse = followups
        .filter((f) => f.response_received && f.response_received_date)
        .sort((a, b) => new Date(b.response_received_date).getTime() - new Date(a.response_received_date).getTime())[0];

      if (finalFollowupWithResponse) {
        const respDate = parseDateOnly(finalFollowupWithResponse.response_received_date) || today;
        responseDelayDays = Math.max(0, calendarDaysDiff(origDate, respDate));
      }
    }

    const activeDelayDays =
      task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
        ? Math.max(0, originalDelayDays - holdDays)
        : Math.max(0, (responseDelayDays || 0) - holdDays);

    // SLA Evaluation
    let slaStatus: 'OK' | 'WARNING' | 'BREACHED' = 'OK';
    if (isOverdue || (task.sla_days && originalDelayDays > task.sla_days)) {
      slaStatus = 'BREACHED';
    } else if (calendarDaysDiff(today, currDate) === 0 && task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
      slaStatus = 'WARNING';
    }

    return {
      originalDelayDays,
      currentDelayDays,
      responseDelayDays,
      activeDelayDays,
      waitingDays,
      resolutionTimeDays,
      followupCount: followups.length,
      isOverdue,
      slaStatus,
    };
  }

  static async getTaskMetrics(supabase: SupabaseClient, taskId: string, orgId: string): Promise<TaskMetrics> {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', orgId)
      .single();

    if (taskError || !task) throw new Error('Task not found');

    const { data: followups } = await supabase
      .from('task_followups')
      .select('*')
      .eq('task_id', taskId)
      .eq('organization_id', orgId);

    return this.calculateMetrics(task, followups || []);
  }
}
