import { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, ValidationError } from '../utils/errors';
import { TaskMetricsService, calendarDaysDiff } from './task-metrics.service';
import { TaskNotificationService } from './task-notification.service';
import { ResponsibilityService } from './responsibility.service';

export interface TaskFilterOptions {
  status?: string;
  priority?: string;
  task_type?: string;
  assigned_user_id?: string;
  assigned_department_id?: string;
  my_tasks?: boolean;
  assigned_to_me?: boolean;
  created_by_me?: boolean;
  due_today?: boolean;
  overdue?: boolean;
  no_update?: boolean;
  partial_update?: boolean;
  sla_breach?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export class TaskService {
  private notificationService: TaskNotificationService;

  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {
    this.notificationService = new TaskNotificationService(supabase, orgId);
  }

  /**
   * Generates a concurrent-safe Task Code (e.g. TASK-2026-000001)
   */
  private async generateTaskCode(): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('generate_next_task_code');
      if (!error && data) {
        return data as string;
      }
    } catch {
      // Fallback if RPC is unavailable in current client context
    }

    const year = new Date().getFullYear();
    const { data: latest } = await this.supabase
      .from('tasks')
      .select('task_code')
      .eq('organization_id', this.orgId)
      .like('task_code', `TASK-${year}-%`)
      .order('task_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (latest && latest.task_code) {
      const parts = latest.task_code.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) seq = parsed + 1;
      }
    }
    return `TASK-${year}-${seq.toString().padStart(6, '0')}`;
  }

  /**
   * Validates organization hierarchy for assignment
   */
  private async validateHierarchy(data: {
    assigned_user_id?: string | null;
    assigned_department_id?: string | null;
    assigned_team_id?: string | null;
  }) {
    if (data.assigned_user_id) {
      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('id, organization_id')
        .eq('id', data.assigned_user_id)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (!userProfile) {
        throw new ValidationError('Assigned user does not belong to your organization');
      }
    }

    if (data.assigned_department_id) {
      const { data: dept } = await this.supabase
        .from('departments')
        .select('id, organization_id')
        .eq('id', data.assigned_department_id)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (!dept) {
        throw new ValidationError('Assigned department does not belong to your organization');
      }
    }

    if (data.assigned_team_id && data.assigned_department_id) {
      const { data: team } = await this.supabase
        .from('teams')
        .select('id, department_id')
        .eq('id', data.assigned_team_id)
        .eq('department_id', data.assigned_department_id)
        .maybeSingle();

      if (!team) {
        throw new ValidationError('Assigned team does not belong to the selected department');
      }
    }
  }

  /**
   * Logs an immutable event to task_timeline
   */
  async logTimelineEvent(taskId: string, eventType: string, eventData: any = {}) {
    try {
      await this.supabase.from('task_timeline').insert({
        task_id: taskId,
        organization_id: this.orgId,
        event_type: eventType,
        event_data: eventData,
        actor_id: this.userId,
      });
    } catch (err) {
      console.warn('Failed to log timeline event:', err);
    }
  }

  /**
   * Logs mutation event to audit_logs
   */
  async logAudit(action: string, entityId: string, oldValues: any = null, newValues: any = null) {
    try {
      await this.supabase.from('audit_logs').insert({
        organization_id: this.orgId,
        actor_id: this.userId,
        action,
        entity_type: 'task',
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
      });
    } catch {
      // Audit log failures should not block transaction
    }
  }

  /**
   * Task Creation workflow
   */
  async createTask(data: {
    title: string;
    description?: string;
    task_type: string;
    task_category?: string;
    priority: string;
    original_due_date: string;
    assigned_user_id?: string | null;
    assigned_department_id?: string | null;
    assigned_team_id?: string | null;
    product_id?: string | null;
    opportunity_id?: string | null;
    source_type?: string | null;
    source_entity_type?: string | null;
    source_entity_id?: string | null;
    responsibility_rule_id?: string | null;
    is_responsibility_overridden?: boolean;
    override_reason?: string | null;
    suggested_department_id?: string | null;
    suggested_user_id?: string | null;
    responsibility_explanation?: string | null;
  }) {
    await this.validateHierarchy(data);

    // If responsibility rule not explicitly resolved or supplied, attempt resolution
    let ruleId = data.responsibility_rule_id || null;
    let assignedDeptId = data.assigned_department_id || null;
    let assignedUserId = data.assigned_user_id || null;
    let suggestedDeptId = data.suggested_department_id || null;
    let suggestedUserId = data.suggested_user_id || null;
    let respExplanation = data.responsibility_explanation || null;

    if (!ruleId || !assignedDeptId) {
      try {
        const respService = new ResponsibilityService(this.supabase, this.orgId, this.userId);
        const resolved = await respService.resolveResponsibility({
          taskType: data.task_type,
          productId: data.product_id,
          departmentId: data.assigned_department_id,
        });

        if (resolved.matchedRule) {
          ruleId = ruleId || resolved.matchedRule.id;
          suggestedDeptId = suggestedDeptId || resolved.responsibleDepartment?.id || null;
          suggestedUserId = suggestedUserId || resolved.suggestedMember?.id || null;
          respExplanation = respExplanation || resolved.explanation;

          // If AUTO_ASSIGN mode and not manually assigned, apply auto assignment
          if (resolved.assignmentMode === 'AUTO_ASSIGN' && !assignedUserId && resolved.suggestedMember) {
            assignedUserId = resolved.suggestedMember.id;
          }
          if (!assignedDeptId && resolved.responsibleDepartment) {
            assignedDeptId = resolved.responsibleDepartment.id;
          }
        }
      } catch (err) {
        console.warn('Responsibility resolution non-blocking error:', err);
      }
    }

    const isOverridden = data.is_responsibility_overridden || Boolean(
      (suggestedUserId && assignedUserId && suggestedUserId !== assignedUserId) ||
      (suggestedDeptId && assignedDeptId && suggestedDeptId !== assignedDeptId)
    );

    const taskCode = await this.generateTaskCode();
    const formattedDueDate = data.original_due_date.split('T')[0];

    let task: any = null;
    const fullPayload: any = {
      organization_id: this.orgId,
      task_code: taskCode,
      title: data.title,
      description: data.description,
      task_type: data.task_type || 'GENERAL',
      task_category: data.task_category,
      priority: data.priority || 'MEDIUM',
      status: 'OPEN',
      original_due_date: formattedDueDate,
      current_due_date: formattedDueDate,
      assigned_user_id: assignedUserId,
      assigned_department_id: assignedDeptId,
      assigned_team_id: data.assigned_team_id,
      product_id: data.product_id,
      opportunity_id: data.opportunity_id,
      source_type: data.source_type,
      source_entity_type: data.source_entity_type,
      source_entity_id: data.source_entity_id,
      responsibility_rule_id: ruleId,
      is_responsibility_overridden: isOverridden,
      suggested_department_id: suggestedDeptId,
      suggested_user_id: suggestedUserId,
      responsibility_explanation: respExplanation,
      created_by: this.userId,
      version: 1,
    };

    const res = await this.supabase
      .from('tasks')
      .insert(fullPayload)
      .select()
      .single();

    if (res.error) {
      // Graceful fallback for older schema cache without current_due_date or responsibility columns
      const fallbackPayload: any = {
        organization_id: this.orgId,
        title: data.title,
        description: data.description,
        task_type: data.task_type || 'GENERAL',
        priority: data.priority || 'MEDIUM',
        status: 'PENDING',
        due_date: formattedDueDate,
        assigned_to: assignedUserId,
        assigned_department: assignedDeptId,
        product_id: data.product_id,
        opportunity_id: data.opportunity_id,
        created_by: this.userId,
      };

      const fallbackRes = await this.supabase
        .from('tasks')
        .insert(fallbackPayload)
        .select()
        .single();

      if (fallbackRes.error) throw fallbackRes.error;
      task = fallbackRes.data;
    } else {
      task = res.data;
    }

    // Log responsibility override if applicable
    if (isOverridden && (data.override_reason || suggestedUserId !== assignedUserId)) {
      try {
        const respService = new ResponsibilityService(this.supabase, this.orgId, this.userId);
        await respService.recordTaskOverride(
          task.id,
          ruleId,
          suggestedDeptId,
          suggestedUserId,
          assignedDeptId,
          assignedUserId,
          data.override_reason || 'Manual assignment differed from configured responsibility rule',
          this.userId
        );
      } catch (err) {
        console.warn('Failed to record task responsibility override:', err);
      }
    }

    await this.logTimelineEvent(task.id, 'TASK_CREATED', {
      task_code: task.task_code || `TASK-${task.id.slice(0, 8)}`,
      priority: task.priority,
      task_type: task.task_type,
      original_due_date: task.original_due_date || task.due_date,
      responsibility_rule_id: ruleId,
      is_overridden: isOverridden,
    });

    await this.logAudit('TASK_CREATED', task.id, null, {
      task_code: task.task_code,
      title: task.title,
      responsibility_rule_id: ruleId,
      assigned_department_id: assignedDeptId,
      assigned_user_id: assignedUserId,
    });

    if (task.assigned_user_id || task.assigned_to) {
      await this.notificationService.notify({
        task_id: task.id,
        task_code: task.task_code || `TASK-${task.id.slice(0, 8)}`,
        task_title: task.title,
        recipient_id: task.assigned_user_id || task.assigned_to,
        type: 'TASK_ASSIGNED',
      });
    }

    return task;
  }

  /**
   * Server-side paginated, filtered, and sorted task list
   */
  async getTasks(filters: TaskFilterOptions = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('organization_id', this.orgId);

    // Filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.task_type) query = query.eq('task_type', filters.task_type);
    if (filters.assigned_user_id) {
      query = query.or(`assigned_user_id.eq.${filters.assigned_user_id},assigned_to.eq.${filters.assigned_user_id}`);
    }
    if (filters.assigned_department_id) {
      query = query.or(`assigned_department_id.eq.${filters.assigned_department_id},assigned_department.eq.${filters.assigned_department_id}`);
    }

    if (filters.my_tasks || filters.assigned_to_me) {
      query = query.or(`assigned_user_id.eq.${this.userId},assigned_to.eq.${this.userId}`);
    }
    if (filters.created_by_me) {
      query = query.eq('created_by', this.userId);
    }

    if (filters.search) {
      const s = filters.search.trim();
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (filters.due_today) {
      query = query.or(`current_due_date.eq.${todayStr},due_date.eq.${todayStr}`);
    }
    if (filters.overdue) {
      query = query.or(`current_due_date.lt.${todayStr},due_date.lt.${todayStr}`).neq('status', 'COMPLETED').neq('status', 'CANCELLED').neq('status', 'ON_HOLD');
    }
    if (filters.no_update) {
      query = query.eq('status', 'WAITING_FOR_UPDATE');
    }
    if (filters.partial_update) {
      query = query.eq('status', 'PARTIAL_UPDATE_RECEIVED');
    }

    // Sorting
    const sortField = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order === 'asc';
    query = query.order(sortField, { ascending: sortOrder }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Load related user profiles cleanly without relying on brittle postgrest relations
    const userIds = new Set<string>();
    (data || []).forEach(t => {
      const uId = t.assigned_user_id || t.assigned_to;
      if (uId) userIds.add(uId);
      if (t.created_by) userIds.add(t.created_by);
    });

    const userProfileMap = new Map<string, any>();
    if (userIds.size > 0) {
      const { data: users } = await this.supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', Array.from(userIds));

      (users || []).forEach(u => userProfileMap.set(u.id, u));
    }

    const enrichedTasks = (data || []).map((task) => {
      const assignedId = task.assigned_user_id || task.assigned_to;
      const assignedUser = assignedId ? userProfileMap.get(assignedId) : null;
      const creator = task.created_by ? userProfileMap.get(task.created_by) : null;

      const metrics = TaskMetricsService.calculateMetrics(task);
      return {
        ...task,
        assigned_user_id: assignedId,
        assigned_user: assignedUser,
        creator,
        original_due_date: task.original_due_date || task.due_date,
        current_due_date: task.current_due_date || task.due_date,
        ...metrics,
      };
    });

    return {
      data: enrichedTasks,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Detailed Task view with full related entities and metrics
   */
  async getTask(id: string) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const assignedId = task.assigned_user_id || task.assigned_to;
    const [assignedUserRes, creatorRes] = await Promise.all([
      assignedId ? this.supabase.from('user_profiles').select('id, full_name, email').eq('id', assignedId).maybeSingle() : Promise.resolve({ data: null }),
      task.created_by ? this.supabase.from('user_profiles').select('id, full_name, email').eq('id', task.created_by).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    task.assigned_user = assignedUserRes.data;
    task.creator = creatorRes.data;

    if (error || !task) throw new NotFoundError('Task not found');

    const [followupsRes, timelineRes, commentsRes, reschedulesRes, watchersRes] = await Promise.all([
      this.supabase
        .from('task_followups')
        .select('*, creator:created_by(full_name)')
        .eq('task_id', id)
        .order('followup_number', { ascending: true }),
      this.supabase
        .from('task_timeline')
        .select('*, actor:actor_id(full_name)')
        .eq('task_id', id)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('task_comments')
        .select('*, author:created_by(full_name)')
        .eq('task_id', id)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('task_reschedules')
        .select('*, requester:requested_by(full_name), approver:approved_by(full_name)')
        .eq('task_id', id)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('task_watchers')
        .select('*, user:user_id(id, full_name, email)')
        .eq('task_id', id),
    ]);

    const followups = followupsRes.data || [];
    const timeline = timelineRes.data || [];
    const comments = commentsRes.data || [];
    const reschedules = reschedulesRes.data || [];
    const watchers = watchersRes.data || [];

    const metrics = TaskMetricsService.calculateMetrics(task, followups);

    return {
      ...task,
      followups,
      timeline,
      comments,
      reschedules,
      watchers,
      metrics,
    };
  }

  /**
   * Update task general fields with optimistic concurrency protection
   */
  async updateTask(id: string, updates: {
    title?: string;
    description?: string;
    priority?: string;
    task_type?: string;
    task_category?: string;
    expected_version?: number;
  }) {
    const { data: existing, error: existErr } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();

    if (existErr || !existing) throw new NotFoundError('Task not found');

    if (updates.expected_version !== undefined && existing.version !== updates.expected_version) {
      throw new ValidationError('Concurrent modification detected. Please refresh the task and try again.');
    }

    const cleanUpdates: Record<string, any> = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
    if (updates.task_type !== undefined) cleanUpdates.task_type = updates.task_type;
    if (updates.task_category !== undefined) cleanUpdates.task_category = updates.task_category;

    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        ...cleanUpdates,
        version: (existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    await this.logTimelineEvent(id, 'TASK_UPDATED', cleanUpdates);
    await this.logAudit('TASK_UPDATED', id, existing, task);
    return task;
  }

  /**
   * Reassign Task
   */
  async assignTask(id: string, data: {
    assigned_user_id: string | null;
    assigned_department_id?: string | null;
    assigned_team_id?: string | null;
    reason?: string;
  }) {
    await this.validateHierarchy(data);

    const { data: existing } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();

    if (!existing) throw new NotFoundError('Task not found');

    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        assigned_user_id: data.assigned_user_id,
        assigned_department_id: data.assigned_department_id,
        assigned_team_id: data.assigned_team_id,
        version: (existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    await this.logTimelineEvent(id, 'TASK_REASSIGNED', {
      previous_assigned_user_id: existing.assigned_user_id,
      new_assigned_user_id: data.assigned_user_id,
      reason: data.reason,
    });

    await this.logAudit('TASK_REASSIGNED', id, { assigned_user_id: existing.assigned_user_id }, { assigned_user_id: data.assigned_user_id });

    if (data.assigned_user_id) {
      await this.notificationService.notify({
        task_id: task.id,
        task_code: task.task_code,
        task_title: task.title,
        recipient_id: data.assigned_user_id,
        type: 'TASK_REASSIGNED',
      });
    }

    return task;
  }

  /**
   * Dedicated No Update Workflow
   * Preserves immutable original_due_date, creates followup record,
   * updates current_due_date, recalculates delay, creates timeline event.
   */
  async recordNoUpdate(taskId: string, data: { next_followup_date: string; remarks?: string; contacted_person?: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const { data: latestFollowup } = await this.supabase
      .from('task_followups')
      .select('followup_number')
      .eq('task_id', taskId)
      .order('followup_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = latestFollowup ? latestFollowup.followup_number + 1 : 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const nextDueDate = data.next_followup_date.split('T')[0];

    const { data: followup, error: followupError } = await this.supabase
      .from('task_followups')
      .insert({
        task_id: taskId,
        organization_id: this.orgId,
        followup_number: nextNumber,
        followup_date: todayStr,
        expected_response_date: nextDueDate,
        next_followup_date: nextDueDate,
        response_status: 'NO_UPDATE',
        response_received: false,
        contacted_person: data.contacted_person,
        remarks: data.remarks,
        created_by: this.userId,
      })
      .select()
      .single();

    if (followupError) throw followupError;

    // Preserves original_due_date, advances current_due_date
    await this.supabase
      .from('tasks')
      .update({
        status: 'WAITING_FOR_UPDATE',
        current_due_date: nextDueDate,
        version: (task.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    const metrics = TaskMetricsService.calculateMetrics(task);

    await this.logTimelineEvent(taskId, 'TASK_NO_UPDATE', {
      followup_number: nextNumber,
      previous_due_date: task.current_due_date,
      next_followup_date: nextDueDate,
      delay_days: metrics.originalDelayDays,
      remarks: data.remarks,
    });

    await this.notificationService.notifyWatchers(taskId, {
      task_id: taskId,
      task_code: task.task_code,
      task_title: task.title,
      type: 'TASK_NO_UPDATE',
      delay_days: metrics.originalDelayDays,
    });

    return followup;
  }

  /**
   * Update Received Workflow
   */
  async recordUpdateReceived(taskId: string, data: {
    response_summary: string;
    final_outcome?: string;
    complete_task?: boolean;
    contacted_person?: string;
    actual_response_date?: string;
  }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const { data: latestFollowup } = await this.supabase
      .from('task_followups')
      .select('followup_number')
      .eq('task_id', taskId)
      .order('followup_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = latestFollowup ? latestFollowup.followup_number + 1 : 1;
    const responseDate = (data.actual_response_date || new Date().toISOString()).split('T')[0];

    const { data: followup, error: followupError } = await this.supabase
      .from('task_followups')
      .insert({
        task_id: taskId,
        organization_id: this.orgId,
        followup_number: nextNumber,
        followup_date: responseDate,
        response_status: 'UPDATE_RECEIVED',
        response_received: true,
        response_received_date: responseDate,
        response_summary: data.response_summary,
        contacted_person: data.contacted_person,
        created_by: this.userId,
      })
      .select()
      .single();

    if (followupError) throw followupError;

    const updatePayload: any = {
      version: (task.version || 1) + 1,
      updated_at: new Date().toISOString(),
    };

    if (data.complete_task) {
      updatePayload.status = 'COMPLETED';
      updatePayload.completed_at = new Date().toISOString();
      updatePayload.completed_by = this.userId;
    } else {
      updatePayload.status = 'IN_PROGRESS';
    }

    await this.supabase.from('tasks').update(updatePayload).eq('id', taskId);

    await this.logTimelineEvent(taskId, 'TASK_UPDATE_RECEIVED', {
      summary: data.response_summary,
      completed: !!data.complete_task,
    });

    if (data.complete_task) {
      await this.logTimelineEvent(taskId, 'TASK_COMPLETED', {
        outcome: data.final_outcome || data.response_summary,
      });

      await this.notificationService.notifyWatchers(taskId, {
        task_id: taskId,
        task_code: task.task_code,
        task_title: task.title,
        type: 'TASK_COMPLETED',
      });
    }

    return followup;
  }

  /**
   * Partial Update Workflow
   */
  async recordPartialUpdate(taskId: string, data: {
    received_summary: string;
    pending_items: string;
    next_followup_date: string;
    contacted_person?: string;
  }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const { data: latestFollowup } = await this.supabase
      .from('task_followups')
      .select('followup_number')
      .eq('task_id', taskId)
      .order('followup_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = latestFollowup ? latestFollowup.followup_number + 1 : 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const nextDateStr = data.next_followup_date.split('T')[0];

    const { data: followup, error: followupError } = await this.supabase
      .from('task_followups')
      .insert({
        task_id: taskId,
        organization_id: this.orgId,
        followup_number: nextNumber,
        followup_date: todayStr,
        expected_response_date: nextDateStr,
        next_followup_date: nextDateStr,
        response_status: 'PARTIAL_UPDATE',
        response_received: true,
        response_received_date: todayStr,
        response_summary: `Received: ${data.received_summary} | Pending: ${data.pending_items}`,
        contacted_person: data.contacted_person,
        created_by: this.userId,
      })
      .select()
      .single();

    if (followupError) throw followupError;

    await this.supabase
      .from('tasks')
      .update({
        status: 'PARTIAL_UPDATE_RECEIVED',
        current_due_date: nextDateStr,
        version: (task.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await this.logTimelineEvent(taskId, 'TASK_PARTIAL_UPDATE', {
      received: data.received_summary,
      pending: data.pending_items,
      next_followup_date: nextDateStr,
    });

    return followup;
  }

  /**
   * Reschedule Workflow (preserves original_due_date)
   */
  async rescheduleTask(taskId: string, data: { new_date: string; reason: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const formattedNewDate = data.new_date.split('T')[0];

    await this.supabase.from('task_reschedules').insert({
      task_id: taskId,
      organization_id: this.orgId,
      previous_due_date: task.current_due_date,
      requested_date: formattedNewDate,
      reason: data.reason,
      status: 'APPROVED',
      requested_by: this.userId,
      approved_by: this.userId,
      approved_at: new Date().toISOString(),
    });

    await this.supabase
      .from('tasks')
      .update({
        current_due_date: formattedNewDate,
        version: (task.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await this.logTimelineEvent(taskId, 'TASK_RESCHEDULED', {
      previous_due_date: task.current_due_date,
      new_due_date: formattedNewDate,
      reason: data.reason,
    });
  }

  /**
   * Task Hold Workflow
   */
  async holdTask(taskId: string, data: { reason: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    const now = new Date().toISOString();

    const { data: updated, error: updateErr } = await this.supabase
      .from('tasks')
      .update({
        status: 'ON_HOLD',
        hold_reason: data.reason,
        hold_at: now,
        version: (task.version || 1) + 1,
        updated_at: now,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await this.logTimelineEvent(taskId, 'TASK_HOLD', { reason: data.reason });
    return updated;
  }

  /**
   * Task Resume Workflow
   */
  async resumeTask(taskId: string) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    let additionalHoldDays = 0;
    if (task.hold_at) {
      additionalHoldDays = Math.max(0, calendarDaysDiff(new Date(task.hold_at), new Date()));
    }

    const totalHoldDays = (task.total_hold_duration_days || 0) + additionalHoldDays;
    const now = new Date().toISOString();

    const { data: updated, error: updateErr } = await this.supabase
      .from('tasks')
      .update({
        status: 'IN_PROGRESS',
        resumed_at: now,
        total_hold_duration_days: totalHoldDays,
        version: (task.version || 1) + 1,
        updated_at: now,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await this.logTimelineEvent(taskId, 'TASK_RESUMED', { added_hold_days: additionalHoldDays });
    return updated;
  }

  /**
   * Explicit Task Completion
   */
  async completeTask(taskId: string, data: { outcome?: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        completed_by: this.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    await this.logTimelineEvent(taskId, 'TASK_COMPLETED', { outcome: data.outcome });
    return task;
  }

  /**
   * Explicit Task Cancellation
   */
  async cancelTask(taskId: string, data: { reason: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: data.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    await this.logTimelineEvent(taskId, 'TASK_CANCELLED', { reason: data.reason });
    return task;
  }

  /**
   * Reopen Task
   */
  async reopenTask(taskId: string, data: { reason?: string }) {
    const { data: task, error } = await this.supabase
      .from('tasks')
      .update({
        status: 'IN_PROGRESS',
        completed_at: null,
        completed_by: null,
        cancelled_at: null,
        cancellation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error || !task) throw new NotFoundError('Task not found');

    await this.logTimelineEvent(taskId, 'TASK_REOPENED', { reason: data.reason });
    return task;
  }

  /**
   * Watchers Management
   */
  async addWatcher(taskId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('task_watchers')
      .insert({
        task_id: taskId,
        organization_id: this.orgId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeWatcher(taskId: string, userId: string) {
    await this.supabase
      .from('task_watchers')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('organization_id', this.orgId);
  }

  /**
   * Add Task Comment
   */
  async addComment(taskId: string, commentText: string) {
    const { data: comment, error } = await this.supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        organization_id: this.orgId,
        comment: commentText,
        created_by: this.userId,
      })
      .select('*, author:created_by(full_name)')
      .single();

    if (error) throw error;

    await this.logTimelineEvent(taskId, 'TASK_COMMENT_ADDED', { comment_id: comment.id });
    return comment;
  }

  /**
   * Real Data Dashboard Analytics
   */
  async getDashboardAnalytics() {
    const { data: tasks, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', this.orgId);

    if (error) throw error;

    let totalOpen = 0;
    let dueToday = 0;
    let overdue = 0;
    let noUpdateCount = 0;
    let partialUpdateCount = 0;
    let onHoldCount = 0;
    let slaBreached = 0;
    let completed = 0;
    let totalDelayDays = 0;
    let delayedTaskCount = 0;
    let totalResponseTimeDays = 0;
    let resolvedTaskCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const departmentDelays: Record<string, { totalDelay: number; count: number }> = {};

    for (const t of tasks || []) {
      const metrics = TaskMetricsService.calculateMetrics(t);

      if (t.status === 'COMPLETED') {
        completed++;
        if (metrics.responseDelayDays && metrics.responseDelayDays > 0) {
          totalDelayDays += metrics.responseDelayDays;
          delayedTaskCount++;
        }
        if (metrics.resolutionTimeDays !== null) {
          totalResponseTimeDays += metrics.resolutionTimeDays;
          resolvedTaskCount++;
        }
      } else if (t.status === 'ON_HOLD') {
        onHoldCount++;
        totalOpen++;
      } else if (t.status !== 'CANCELLED') {
        totalOpen++;
        if (t.status === 'WAITING_FOR_UPDATE') noUpdateCount++;
        if (t.status === 'PARTIAL_UPDATE_RECEIVED') partialUpdateCount++;

        const currDateStr = t.current_due_date ? t.current_due_date.split('T')[0] : '';
        if (currDateStr === todayStr) dueToday++;
        if (metrics.isOverdue) overdue++;
        if (metrics.slaStatus === 'BREACHED') slaBreached++;

        if (metrics.currentDelayDays > 0) {
          totalDelayDays += metrics.currentDelayDays;
          delayedTaskCount++;
        }
      }

      if (t.assigned_department_id) {
        if (!departmentDelays[t.assigned_department_id]) {
          departmentDelays[t.assigned_department_id] = { totalDelay: 0, count: 0 };
        }
        departmentDelays[t.assigned_department_id].totalDelay += metrics.originalDelayDays;
        departmentDelays[t.assigned_department_id].count++;
      }
    }

    const averageDelay = delayedTaskCount > 0 ? Math.round(totalDelayDays / delayedTaskCount) : 0;
    const averageResponseTime = resolvedTaskCount > 0 ? Math.round(totalResponseTimeDays / resolvedTaskCount) : 0;

    return {
      totalTasks: (tasks || []).length,
      totalOpen,
      dueToday,
      overdue,
      noUpdateCount,
      partialUpdateCount,
      onHoldCount,
      slaBreached,
      completed,
      averageDelay,
      averageResponseTime,
      departmentDelays,
    };
  }
}
