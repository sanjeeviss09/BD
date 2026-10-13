import { Request, Response } from 'express';
import { z } from 'zod';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { createSupabaseClientForUser } from '../db/supabase';

const extractValidationErrors = (err: any) => err.issues || err.errors || [];

const createDefinitionSchema = z.object({
  code: z.string().min(1, 'Workflow code is required'),
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  entity_type: z.string().optional(),
});

const createVersionSchema = z.object({
  name: z.string().min(1, 'Version name is required'),
  description: z.string().optional(),
});

const createStageSchema = z.object({
  stage_code: z.string().min(1, 'Stage code is required'),
  stage_name: z.string().min(1, 'Stage name is required'),
  description: z.string().optional(),
  sort_order: z.number().int(),
  stage_type: z.enum(['START', 'PROCESS', 'DECISION', 'TERMINAL']),
  default_probability: z.number().min(0).max(100).optional(),
  sla_days: z.number().int().positive().optional(),
  warning_days: z.number().int().nonnegative().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  responsible_role_id: z.string().uuid().optional(),
  responsible_department_id: z.string().uuid().optional(),
  default_owner_id: z.string().uuid().optional(),
  entry_conditions: z.array(z.any()).optional(),
  completion_conditions: z.array(z.any()).optional(),
});

const createTransitionSchema = z.object({
  transition_code: z.string().min(1, 'Transition code is required'),
  transition_name: z.string().min(1, 'Transition name is required'),
  from_stage_id: z.string().uuid('from_stage_id must be a UUID'),
  to_stage_id: z.string().uuid('to_stage_id must be a UUID'),
  required_permission: z.string().optional(),
  requires_comment: z.boolean().optional(),
  comment_prompt: z.string().optional(),
  conditions_json: z.array(z.any()).optional(),
  sort_order: z.number().int().optional(),
});

const executeTransitionSchema = z.object({
  transition_id: z.string().uuid().optional(),
  target_stage_code: z.string().optional(),
  reason: z.string().optional(),
  comment: z.string().optional(),
  expected_version: z.number().int().optional(),
});

const reassignOwnerSchema = z.object({
  new_owner_id: z.string().uuid('new_owner_id must be a valid UUID'),
  reason: z.string().optional(),
});

export class WorkflowController {
  private static getService(req: Request) {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || (req as any).user?.organization_id;
    const userId = req.userContext?.profile_id || (req as any).user?.id;

    if (!orgId || !userId) {
      throw new Error('User context and organization ID required.');
    }

    return new WorkflowEngineService(supabase, orgId, userId);
  }

  // 1. Definitions
  public static async listDefinitions(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.listDefinitions();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getDefinition(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.getDefinitionById(req.params.id as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  public static async createDefinition(req: Request, res: Response) {
    try {
      const parsed = createDefinitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.createDefinition(parsed.data);
      return res.status(201).json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // 2. Versions
  public static async listVersions(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.listVersions(req.params.definitionId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getVersion(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.getVersionById(req.params.versionId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  public static async createVersion(req: Request, res: Response) {
    try {
      const parsed = createVersionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.createVersion(req.params.definitionId as string, parsed.data);
      return res.status(201).json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async validateVersion(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.validateVersionGraph(req.params.versionId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async activateVersion(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.activateVersion(req.params.versionId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // 3. Stages & Transitions
  public static async createStage(req: Request, res: Response) {
    try {
      const parsed = createStageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.createStage(req.params.versionId as string, parsed.data as any);
      return res.status(201).json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async createTransition(req: Request, res: Response) {
    try {
      const parsed = createTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.createTransition(req.params.versionId as string, parsed.data as any);
      return res.status(201).json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // 4. Opportunity Instance & Operational Lifecycle
  public static async getOpportunityInstance(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.getOrCreateInstanceForOpportunity(req.params.opportunityId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getValidTransitions(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.getValidTransitions(req.params.opportunityId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async executeTransition(req: Request, res: Response) {
    try {
      const parsed = executeTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.executeTransition(req.params.opportunityId as string, parsed.data);
      return res.json({ success: true, data });
    } catch (err: any) {
      const status = err.message?.includes('CONCURRENT_UPDATE') ? 409 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }
  }

  public static async reassignStageOwner(req: Request, res: Response) {
    try {
      const parsed = reassignOwnerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const service = WorkflowController.getService(req);
      const data = await service.reassignStageOwner(req.params.opportunityId as string, parsed.data.new_owner_id, parsed.data.reason);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async getOpportunityHistory(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const data = await service.getStageHistory(req.params.opportunityId as string);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 5. Analytics
  public static async getWorkflowAnalytics(req: Request, res: Response) {
    try {
      const service = WorkflowController.getService(req);
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const data = await service.getWorkflowAnalytics({ date_from: dateFrom, date_to: dateTo });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
