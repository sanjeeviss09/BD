import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { ResponsibilityService } from '../services/responsibility.service';
import { AppError, ValidationError } from '../utils/errors';
import { z } from 'zod';

const createRuleSchema = z.object({
  rule_name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  unit_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  task_type: z.string().optional().nullable(),
  business_area: z.string().optional().nullable(),
  product_type: z.string().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  molecule_id: z.string().uuid().optional().nullable(),
  opportunity_type: z.string().optional().nullable(),
  responsible_department_id: z.string().uuid('Responsible department is required'),
  primary_member_id: z.string().uuid().optional().nullable(),
  backup_member_id: z.string().uuid().optional().nullable(),
  escalation_manager_id: z.string().uuid().optional().nullable(),
  escalation_level2_id: z.string().uuid().optional().nullable(),
  escalation_level3_id: z.string().uuid().optional().nullable(),
  response_sla_days: z.number().int().min(1).default(2),
  completion_sla_days: z.number().int().min(1).default(7),
  followup_interval_days: z.number().int().min(1).default(2),
  escalation_delay_days: z.number().int().min(1).default(2),
  sla_calendar_type: z.enum(['BUSINESS_DAYS', 'CALENDAR_DAYS']).default('BUSINESS_DAYS'),
  assignment_mode: z.enum(['AUTO_ASSIGN', 'SUGGEST', 'MANUAL']).default('SUGGEST'),
  priority_score: z.number().int().default(100),
  effective_from: z.string().optional(),
  effective_to: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).default('ACTIVE'),
  change_reason: z.string().optional(),
});

export class ResponsibilityController {
  private getService(req: Request): ResponsibilityService {
    const orgId = req.userContext?.organization_id || (req as any).user?.organization_id;
    const userId = (req as any).user?.id;
    if (!orgId) throw new AppError('Unauthorized: Missing organization context', 401);
    const supabase = createSupabaseClientForUser(req);
    return new ResponsibilityService(supabase, orgId, userId);
  }

  listRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.listRules(req.query);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getRule(req.params.id as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const validated = createRuleSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const data = await service.createRule(validated, userId);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new ValidationError('Invalid rule data', (err as any).issues || (err as any).errors));
      } else {
        next(err);
      }
    }
  };

  updateRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const userId = (req as any).user?.id;
      const data = await service.updateRule(req.params.id as string, req.body, userId, req.body.change_reason);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  deactivateRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const userId = (req as any).user?.id;
      const data = await service.deactivateRule(req.params.id as string, userId, req.body.reason);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  duplicateRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const userId = (req as any).user?.id;
      const data = await service.duplicateRule(req.params.id as string, userId);
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  };

  getAuditHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getAuditHistory(req.params.id as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  resolveResponsibility = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const context = req.body;
      const result = await service.resolveResponsibility(context);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  detectConflicts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.detectConflicts();
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getMatrixView = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getMatrixView();
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getDepartmentMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getDepartmentMembers(req.params.departmentId as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  exportRulesToExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const buffer = await service.exportRulesToExcel();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="responsibility_rules.xlsx"');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };

  importRulesFromExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file || !req.file.buffer) {
        throw new ValidationError('Please upload an Excel file (.xlsx)');
      }
      const service = this.getService(req);
      const userId = (req as any).user?.id;
      const result = await service.importRulesFromExcel(req.file.buffer, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
