import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface TaskDates {
  createdDate: Date;
  dueDate: Date;
  completedDate?: Date | null;
  actualResponseDate?: Date | null;
}

export interface DelayMetrics {
  responseDelayDays: number | null;
  currentDelayDays: number;
  waitingTimeDays: number;
  isSlaBreached: boolean;
}

export class DelayService {
  /**
   * Calculate all delay metrics based on the organization's timezone
   * @param taskDates Relevant dates for the task
   * @param organizationTimezone Valid IANA timezone string (e.g., 'America/New_York', 'Asia/Kolkata')
   * @returns DelayMetrics
   */
  static calculateDelays(
    taskDates: TaskDates,
    organizationTimezone: string = 'UTC'
  ): DelayMetrics {
    const today = dayjs().tz(organizationTimezone).startOf('day');
    const created = dayjs(taskDates.createdDate).tz(organizationTimezone).startOf('day');
    const due = dayjs(taskDates.dueDate).tz(organizationTimezone).startOf('day');
    
    // 1. Response Delay (if response received)
    let responseDelayDays = null;
    if (taskDates.actualResponseDate) {
      const response = dayjs(taskDates.actualResponseDate).tz(organizationTimezone).startOf('day');
      responseDelayDays = response.diff(due, 'day');
    }

    // 2. Current Delay (if task is not completed and no response date exists)
    let currentDelayDays = 0;
    if (!taskDates.completedDate && !taskDates.actualResponseDate) {
      currentDelayDays = today.diff(due, 'day');
      // If the due date is in the future, delay is 0 or negative. We typically cap at 0 if we only care about overdue.
      // But preserving the actual difference is better for analysis.
    }

    // 3. Waiting Time
    const waitingTimeDays = today.diff(created, 'day');

    // 4. SLA Breach (current_date > due_date AND task not completed)
    const isSlaBreached = !taskDates.completedDate && today.isAfter(due);

    return {
      responseDelayDays,
      currentDelayDays,
      waitingTimeDays,
      isSlaBreached
    };
  }
}
