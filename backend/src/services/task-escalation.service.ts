import { SupabaseClient } from '@supabase/supabase-js';
import { TaskMetricsService } from './task-metrics.service';
import { TaskNotificationService } from './task-notification.service';

export interface EscalationRule {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggerDelayDays: number;
  escalationTier: 1 | 2 | 3; // 1 = Owner reminder, 2 = Department Head / BD Manager, 3 = Executive Leadership
}

export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  { priority: 'CRITICAL', triggerDelayDays: 1, escalationTier: 2 },
  { priority: 'CRITICAL', triggerDelayDays: 2, escalationTier: 3 },
  { priority: 'HIGH', triggerDelayDays: 2, escalationTier: 2 },
  { priority: 'HIGH', triggerDelayDays: 4, escalationTier: 3 },
  { priority: 'MEDIUM', triggerDelayDays: 5, escalationTier: 2 },
  { priority: 'LOW', triggerDelayDays: 10, escalationTier: 2 },
];

export class TaskEscalationService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /**
   * Evaluates escalation status for a given task
   */
  async evaluateTaskEscalation(task: any): Promise<{
    isEscalated: boolean;
    tier: number;
    delayDays: number;
  }> {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED' || task.status === 'ON_HOLD') {
      return { isEscalated: false, tier: 0, delayDays: 0 };
    }

    const metrics = TaskMetricsService.calculateMetrics(task);
    const delay = metrics.originalDelayDays;

    if (delay <= 0) {
      return { isEscalated: false, tier: 0, delayDays: 0 };
    }

    // Match applicable escalation rule
    const matchingRules = DEFAULT_ESCALATION_RULES.filter(
      (r) => r.priority === task.priority && delay >= r.triggerDelayDays
    ).sort((a, b) => b.escalationTier - a.escalationTier);

    if (matchingRules.length > 0) {
      const topRule = matchingRules[0];
      return {
        isEscalated: true,
        tier: topRule.escalationTier,
        delayDays: delay,
      };
    }

    return { isEscalated: false, tier: 0, delayDays: delay };
  }

  /**
   * Processes task escalation and sends alerts through organization hierarchy
   */
  async processEscalation(task: any): Promise<boolean> {
    const evalResult = await this.evaluateTaskEscalation(task);
    if (!evalResult.isEscalated) return false;

    const notificationService = new TaskNotificationService(this.supabase, this.orgId);

    // If tier 2, alert owner and check if department has a designated head
    if (task.assigned_user_id) {
      await notificationService.notify({
        task_id: task.id,
        task_code: task.task_code,
        task_title: task.title,
        recipient_id: task.assigned_user_id,
        type: 'TASK_SLA_BREACH',
        delay_days: evalResult.delayDays,
        metadata: { escalation_tier: evalResult.tier },
      });
    }

    // Log escalation timeline event
    try {
      await this.supabase.from('task_timeline').insert({
        task_id: task.id,
        organization_id: this.orgId,
        event_type: 'TASK_ESCALATED',
        event_data: {
          tier: evalResult.tier,
          delay_days: evalResult.delayDays,
          priority: task.priority,
        },
      });
    } catch {
      // Timeline logging non-blocking
    }

    return true;
  }
}
