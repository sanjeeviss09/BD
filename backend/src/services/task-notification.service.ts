import { SupabaseClient } from '@supabase/supabase-js';

export interface TaskNotificationPayload {
  task_id: string;
  task_code: string;
  task_title: string;
  recipient_id: string;
  type: 
    | 'TASK_ASSIGNED'
    | 'TASK_REASSIGNED'
    | 'TASK_DUE_TODAY'
    | 'TASK_OVERDUE'
    | 'TASK_FOLLOWUP_DUE'
    | 'TASK_NO_UPDATE'
    | 'TASK_SLA_BREACH'
    | 'TASK_COMPLETED';
  delay_days?: number;
  metadata?: Record<string, any>;
}

export class TaskNotificationService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /**
   * Generates formatted title and message from event type and placeholders
   */
  private formatNotificationContent(payload: TaskNotificationPayload): { title: string; message: string } {
    switch (payload.type) {
      case 'TASK_ASSIGNED':
        return {
          title: `Task Assigned: ${payload.task_code}`,
          message: `You have been assigned to task "${payload.task_title}".`,
        };
      case 'TASK_REASSIGNED':
        return {
          title: `Task Reassigned: ${payload.task_code}`,
          message: `Task "${payload.task_title}" has been reassigned to you.`,
        };
      case 'TASK_DUE_TODAY':
        return {
          title: `Task Update Due Today: ${payload.task_code}`,
          message: `Task "${payload.task_title}" has an expected follow-up due today.`,
        };
      case 'TASK_OVERDUE':
        return {
          title: `Task Overdue Alert: ${payload.task_code}`,
          message: `Task "${payload.task_title}" is past due by ${payload.delay_days || 1} day(s). Immediate action required.`,
        };
      case 'TASK_FOLLOWUP_DUE':
        return {
          title: `Follow-up Due: ${payload.task_code}`,
          message: `Next follow-up action is due today for task "${payload.task_title}".`,
        };
      case 'TASK_NO_UPDATE':
        return {
          title: `No Update Recorded: ${payload.task_code}`,
          message: `A "No Update" response was logged for "${payload.task_title}". Active delay: ${payload.delay_days || 0} day(s).`,
        };
      case 'TASK_SLA_BREACH':
        return {
          title: `SLA Breach Alert: ${payload.task_code}`,
          message: `Task "${payload.task_title}" has breached its SLA commitment window.`,
        };
      case 'TASK_COMPLETED':
        return {
          title: `Task Resolved: ${payload.task_code}`,
          message: `Task "${payload.task_title}" has been completed.`,
        };
      default:
        return {
          title: `Task Update: ${payload.task_code}`,
          message: `New activity on task "${payload.task_title}".`,
        };
    }
  }

  /**
   * Sends in-app notification with idempotency check
   */
  async notify(payload: TaskNotificationPayload): Promise<boolean> {
    if (!payload.recipient_id) return false;

    const { title, message } = this.formatNotificationContent(payload);

    try {
      // Idempotency: Check if identical notification was already sent today for this task
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: existing } = await this.supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', this.orgId)
        .eq('recipient_id', payload.recipient_id)
        .eq('entity_id', payload.task_id)
        .eq('type', payload.type)
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Notification already sent today
        return false;
      }

      await this.supabase.from('notifications').insert({
        organization_id: this.orgId,
        recipient_id: payload.recipient_id,
        type: payload.type,
        title,
        message,
        entity_type: 'task',
        entity_id: payload.task_id,
      });

      return true;
    } catch (err) {
      console.warn('Failed to dispatch notification:', err);
      return false;
    }
  }

  /**
   * Dispatches notifications to all task watchers
   */
  async notifyWatchers(taskId: string, payload: Omit<TaskNotificationPayload, 'recipient_id'>) {
    try {
      const { data: watchers } = await this.supabase
        .from('task_watchers')
        .select('user_id')
        .eq('task_id', taskId)
        .eq('organization_id', this.orgId);

      if (watchers && watchers.length > 0) {
        for (const w of watchers) {
          await this.notify({ ...payload, recipient_id: w.user_id });
        }
      }
    } catch (err) {
      console.warn('Failed to notify watchers:', err);
    }
  }
}
