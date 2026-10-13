import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSupabaseClientForUser } from '../db/supabase';
import { TaskService } from '../services/task.service';
import { TaskJobService } from '../services/task-job.service';
import { ValidationError } from '../utils/errors';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  task_type: z.string().min(1, 'Task type is required'),
  task_category: z.string().optional(),
  priority: z.string().min(1, 'Priority is required'),
  original_due_date: z.string().min(1, 'Original due date is required'),
  assigned_user_id: z.string().uuid().optional().nullable(),
  assigned_department_id: z.string().uuid().optional().nullable(),
  assigned_team_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  opportunity_id: z.string().uuid().optional().nullable(),
  meeting_id: z.string().uuid().optional().nullable(),
  risk_level: z.string().optional().nullable(),
  risk_reason: z.string().optional().nullable(),
  converted_from_candidate_id: z.string().uuid().optional().nullable(),
  responsibility_rule_id: z.string().uuid().optional().nullable(),
  is_responsibility_overridden: z.boolean().optional(),
  override_reason: z.string().optional().nullable(),
  suggested_department_id: z.string().uuid().optional().nullable(),
  suggested_user_id: z.string().uuid().optional().nullable(),
  responsibility_explanation: z.string().optional().nullable(),
});

export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validatedData = createTaskSchema.parse(req.body);
    const task = await taskService.createTask(validatedData as any);

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid task data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const getTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const result = await taskService.getTasks(req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const task = await taskService.getTask(req.params.id as string);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  task_type: z.string().optional(),
  task_category: z.string().optional(),
  risk_level: z.string().optional().nullable(),
  risk_reason: z.string().optional().nullable(),
  expected_version: z.number().int().optional(),
});

export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = updateTaskSchema.parse(req.body);
    const task = await taskService.updateTask(req.params.id as string, validated);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const assignTaskSchema = z.object({
  assigned_user_id: z.string().uuid().nullable(),
  assigned_department_id: z.string().uuid().optional().nullable(),
  assigned_team_id: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
});

export const assignTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = assignTaskSchema.parse(req.body);
    const task = await taskService.assignTask(req.params.id as string, validated);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid assignment data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const recordNoUpdateSchema = z.object({
  next_followup_date: z.string().min(1, 'Next follow-up date is required'),
  remarks: z.string().optional(),
  contacted_person: z.string().optional(),
});

export const recordNoUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validatedData = recordNoUpdateSchema.parse(req.body);
    const followup = await taskService.recordNoUpdate(req.params.id as string, validatedData);

    res.status(201).json(followup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const recordUpdateSchema = z.object({
  response_summary: z.string().min(1, 'Response summary is required'),
  final_outcome: z.string().optional(),
  complete_task: z.boolean().optional(),
  contacted_person: z.string().optional(),
  actual_response_date: z.string().optional(),
});

export const recordUpdateReceived = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validatedData = recordUpdateSchema.parse(req.body);
    const followup = await taskService.recordUpdateReceived(req.params.id as string, validatedData);

    res.status(200).json({ message: 'Update recorded successfully', followup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const recordPartialUpdateSchema = z.object({
  received_summary: z.string().min(1, 'Received summary is required'),
  pending_items: z.string().min(1, 'Pending items description is required'),
  next_followup_date: z.string().min(1, 'Next follow-up date is required'),
  contacted_person: z.string().optional(),
});

export const recordPartialUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validatedData = recordPartialUpdateSchema.parse(req.body);
    const followup = await taskService.recordPartialUpdate(req.params.id as string, validatedData);

    res.status(200).json({ message: 'Partial update recorded successfully', followup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const rescheduleSchema = z.object({
  new_date: z.string().min(1, 'New date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export const rescheduleTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validatedData = rescheduleSchema.parse(req.body);
    await taskService.rescheduleTask(req.params.id as string, validatedData);

    res.status(200).json({ message: 'Task rescheduled successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

const holdTaskSchema = z.object({
  reason: z.string().min(1, 'Hold reason is required'),
});

export const holdTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = holdTaskSchema.parse(req.body);
    const task = await taskService.holdTask(req.params.id as string, validated);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid hold data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const resumeTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const task = await taskService.resumeTask(req.params.id as string);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

export const completeTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const task = await taskService.completeTask(req.params.id as string, req.body);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

const cancelTaskSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const cancelTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = cancelTaskSchema.parse(req.body);
    const task = await taskService.cancelTask(req.params.id as string, validated);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid cancellation data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const reopenTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const task = await taskService.reopenTask(req.params.id as string, req.body);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

const addWatcherSchema = z.object({
  user_id: z.string().uuid('Valid user UUID required'),
});

export const addWatcher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = addWatcherSchema.parse(req.body);
    const watcher = await taskService.addWatcher(req.params.id as string, validated.user_id);
    res.status(201).json(watcher);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid watcher data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const removeWatcher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    await taskService.removeWatcher(req.params.id as string, req.params.userId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const addCommentSchema = z.object({
  comment: z.string().min(1, 'Comment text cannot be empty'),
});

export const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const validated = addCommentSchema.parse(req.body);
    const comment = await taskService.addComment(req.params.id as string, validated.comment);
    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid comment data', (error as any).issues || (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const getDashboardAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const userId = req.user!.id;
    const taskService = new TaskService(supabase, orgId, userId);

    const metrics = await taskService.getDashboardAnalytics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

export const runMonitoringJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const jobService = new TaskJobService(supabase, orgId);

    const result = await jobService.runDailyMonitoringJob();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
