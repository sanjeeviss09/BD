import { Request, Response } from 'express';
import { z } from 'zod';
import { OpportunityService } from '../services/opportunity.service';
import { OpportunityWorkflowService } from '../services/opportunity-workflow.service';
import { OpportunityScoringService } from '../services/opportunity-scoring.service';
import { createSupabaseClientForUser } from '../db/supabase';

const extractValidationErrors = (err: any) => err.issues || err.errors || [];

const createOpportunitySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  opportunity_type: z.string().optional(),
  source: z.string().optional(),
  product_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
  country_id: z.string().uuid().optional(),
  target_countries: z.array(z.string()).optional(),
  priority: z.string().optional(),
  stage: z.string().optional(),
  estimated_value: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_decision_date: z.string().optional(),
  target_launch_date: z.string().optional(),
  target_market_date: z.string().optional(),
  next_action: z.string().optional(),
  next_action_date: z.string().optional(),
});

const updateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  opportunity_type: z.string().optional(),
  source: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
  priority: z.string().optional(),
  strategic_priority: z.string().optional(),
  risk_level: z.string().optional(),
  estimated_value: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_decision_date: z.string().optional(),
  target_launch_date: z.string().optional(),
  target_market_date: z.string().optional(),
  next_action: z.string().optional(),
  next_action_date: z.string().optional(),
  version: z.number().int().nonnegative('Version is required for optimistic concurrency'),
});

const transitionStageSchema = z.object({
  stage: z.string().min(1, 'Target stage is required'),
  closed_reason: z.string().optional(),
});

const qualificationScoreItemSchema = z.object({
  criterion_key: z.string().min(1),
  criterion_name: z.string().optional(),
  score: z.number().min(0).max(100),
  weight: z.number().positive().optional(),
  comment: z.string().optional(),
  evidence_reference: z.string().optional(),
});

const recordQualificationSchema = z.object({
  criteria: z.array(qualificationScoreItemSchema).min(1, 'At least one criterion is required'),
});

const closeOpportunitySchema = z.object({
  status: z.enum(['WON', 'LOST', 'CANCELLED']),
  reason: z.string().min(1, 'Reason is required'),
  comment: z.string().optional(),
});

const addProductSchema = z.object({
  product_id: z.string().uuid('Valid product ID is required'),
  relationship_type: z.string().optional(),
  is_primary: z.boolean().optional(),
});

const addMarketSchema = z.object({
  country_code: z.string().min(2, 'Country code is required'),
  market_role: z.string().optional(),
  priority: z.string().optional(),
  target_date: z.string().optional(),
});

const addRiskSchema = z.object({
  risk_type: z.string().min(1, 'Risk type is required'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().min(1, 'Description is required'),
  mitigation: z.string().optional(),
  target_resolution_date: z.string().optional(),
});

const addRequirementSchema = z.object({
  requirement_type: z.string().min(1, 'Requirement type is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.string().optional(),
  status: z.string().optional(),
  due_date: z.string().optional(),
  source: z.string().optional(),
  evidence: z.string().optional(),
});

const commentSchema = z.object({
  comment: z.string().min(1, 'Comment text is required'),
});

export class OpportunityController {
  private static getService(req: Request) {
    const supabase = createSupabaseClientForUser(req);
    const orgId = (req as any).user?.organization_id;
    const userId = (req as any).user?.id;

    if (!orgId || !userId) {
      throw new Error('Unauthorized: Missing user or organization context');
    }

    return new OpportunityService(supabase, orgId, userId);
  }

  public static async createOpportunity(req: Request, res: Response) {
    try {
      const parsed = createOpportunitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.createOpportunity(parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getOpportunities(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      const {
        page,
        limit,
        search,
        stage,
        status,
        priority,
        opportunity_type,
        source,
        owner_id,
        product_id,
        overdue_next_action,
        sort_by,
        sort_order,
      } = req.query;

      const result = await service.getOpportunities({
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        search: search as string,
        stage: stage as string,
        status: status as string,
        priority: priority as string,
        opportunity_type: opportunity_type as string,
        source: source as string,
        owner_id: owner_id as string,
        product_id: product_id as string,
        overdue_next_action: overdue_next_action === 'true',
        sort_by: sort_by as string,
        sort_order: sort_order as 'asc' | 'desc',
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getOpportunityById(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      const data = await service.getOpportunityById(req.params.id as string);
      return res.json({ data });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }

  public static async updateOpportunity(req: Request, res: Response) {
    try {
      const parsed = updateOpportunitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.updateOpportunity(req.params.id as string, parsed.data);
      return res.json({ data });
    } catch (err: any) {
      if (err.message.includes('Concurrent modification')) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  public static async transitionStage(req: Request, res: Response) {
    try {
      const parsed = transitionStageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.transitionStage(
        req.params.id as string,
        parsed.data.stage,
        parsed.data.closed_reason
      );
      return res.json({ data });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  public static async recordQualification(req: Request, res: Response) {
    try {
      const parsed = recordQualificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.recordQualification(req.params.id as string, parsed.data.criteria);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async closeOpportunity(req: Request, res: Response) {
    try {
      const parsed = closeOpportunitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.closeOpportunity(
        req.params.id as string,
        parsed.data.status,
        parsed.data.reason,
        parsed.data.comment
      );
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async reopenOpportunity(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      const data = await service.reopenOpportunity(req.params.id as string);
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Child Entities
  public static async addProduct(req: Request, res: Response) {
    try {
      const parsed = addProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.addProduct(
        req.params.id as string,
        parsed.data.product_id,
        parsed.data.relationship_type,
        parsed.data.is_primary
      );
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async removeProduct(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      await service.removeProduct(req.params.id as string, req.params.productId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async addMarket(req: Request, res: Response) {
    try {
      const parsed = addMarketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.addMarket(
        req.params.id as string,
        parsed.data.country_code,
        parsed.data.market_role,
        parsed.data.priority,
        parsed.data.target_date
      );
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async removeMarket(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      await service.removeMarket(req.params.id as string, req.params.marketId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async addRisk(req: Request, res: Response) {
    try {
      const parsed = addRiskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.addRisk(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deleteRisk(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      await service.deleteRisk(req.params.id as string, req.params.riskId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async addRequirement(req: Request, res: Response) {
    try {
      const parsed = addRequirementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.addRequirement(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deleteRequirement(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      await service.deleteRequirement(req.params.id as string, req.params.reqId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async addComment(req: Request, res: Response) {
    try {
      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const service = OpportunityController.getService(req);
      const data = await service.addComment(req.params.id as string, parsed.data.comment);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getAnalytics(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      const data = await service.getDashboardAnalytics();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async exportOpportunities(req: Request, res: Response) {
    try {
      const service = OpportunityController.getService(req);
      const csv = await service.exportOpportunities(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=opportunities_export.csv');
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getStages(req: Request, res: Response) {
    return res.json({ data: OpportunityWorkflowService.getStages() });
  }

  public static async getCriteria(req: Request, res: Response) {
    return res.json({ data: OpportunityScoringService.getCriteria() });
  }
}
