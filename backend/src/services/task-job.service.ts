import { SupabaseClient } from '@supabase/supabase-js';
import { TaskNotificationService } from './task-notification.service';
import { TaskEscalationService } from './task-escalation.service';
import { TaskMetricsService } from './task-metrics.service';

export interface JobExecutionResult {
  jobName: string;
  processedCount: number;
  alertsSent: number;
  errorsCount: number;
  timestamp: string;
}

export class TaskJobService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /**
   * Evaluates all open tasks and sends due/overdue reminders
   */
  async runDailyMonitoringJob(): Promise<JobExecutionResult> {
    const todayStr = new Date().toISOString().split('T')[0];
    const notificationService = new TaskNotificationService(this.supabase, this.orgId);
    const escalationService = new TaskEscalationService(this.supabase, this.orgId);

    const { data: openTasks, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', this.orgId)
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED');

    if (error || !openTasks) {
      return {
        jobName: 'DailyMonitoringJob',
        processedCount: 0,
        alertsSent: 0,
        errorsCount: 1,
        timestamp: new Date().toISOString(),
      };
    }

    let alertsSent = 0;
    let errorsCount = 0;

    for (const task of openTasks) {
      try {
        const metrics = TaskMetricsService.calculateMetrics(task);

        // 1. Due Today reminder
        if (task.current_due_date === todayStr && task.assigned_user_id) {
          const sent = await notificationService.notify({
            task_id: task.id,
            task_code: task.task_code,
            task_title: task.title,
            recipient_id: task.assigned_user_id,
            type: 'TASK_DUE_TODAY',
          });
          if (sent) alertsSent++;
        }

        // 2. Overdue reminder
        if (metrics.isOverdue && task.assigned_user_id) {
          const sent = await notificationService.notify({
            task_id: task.id,
            task_code: task.task_code,
            task_title: task.title,
            recipient_id: task.assigned_user_id,
            type: 'TASK_OVERDUE',
            delay_days: metrics.originalDelayDays,
          });
          if (sent) alertsSent++;
        }

        // 3. Escalation check
        if (metrics.originalDelayDays > 0) {
          const escalated = await escalationService.processEscalation(task);
          if (escalated) alertsSent++;
        }
      } catch (err) {
        errorsCount++;
        console.error(`Error processing task ${task.id} in monitoring job:`, err);
      }
    }

    return {
      jobName: 'DailyMonitoringJob',
      processedCount: openTasks.length,
      alertsSent,
      errorsCount,
      timestamp: new Date().toISOString(),
    };
  }
}
