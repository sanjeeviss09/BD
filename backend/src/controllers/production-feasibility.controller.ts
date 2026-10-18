import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { ProductionFeasibilityService } from '../services/production-feasibility.service';
import { ProductionFacilityService } from '../services/production-facility.service';
import { ProductionExportService } from '../services/production-export.service';
import { FacilityImportService } from '../services/facility-import.service';
import { AIProviderService } from '../services/ai-provider.service';

export class ProductionFeasibilityController {
  // ==========================================
  // FEASIBILITY CRUD & ACTIONS
  // ==========================================

  static async getFeasibilityList(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.getFeasibilityList(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getDashboardAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.getDashboardAnalytics();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getFeasibilityById(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.getFeasibilityById(req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.createFeasibility(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.updateFeasibility(req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async evaluateFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.evaluateFeasibility(req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async finalizeFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.finalizeFeasibility(req.params.id as string, req.body.finalize_reason);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async reviseFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.reviseFeasibility(req.params.id as string, req.body.change_summary);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async convertGapToTask(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.convertGapToTask(req.params.id as string, req.params.gapId as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async exportFeasibility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const feasibility = await service.getFeasibilityById(req.params.id as string);

      const buffer = ProductionExportService.generateFeasibilityWorkbook(feasibility);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${feasibility.feasibility_code || 'production-feasibility'}.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // FACILITY & INFRASTRUCTURE MASTERS
  // ==========================================

  static async getFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.getFacilities();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getFacilityById(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.getFacilityById(req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.createFacility(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.updateFacility(req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getLines(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.getLines(req.query.facility_id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createLine(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.createLine(req.params.facilityId as string, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.getEquipment(
        req.query.facility_id as string,
        req.query.line_id as string
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.createEquipment(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getTechnologies(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.getTechnologies(req.query.facility_id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createTechnology(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const result = await service.createTechnology(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getCapacityAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const result = await service.getCapacityAllocations(req.query.facility_id as string, year);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async compareFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFacilityService(supabase, orgId, userId);
      const annualVolume = req.query.annual_volume ? parseFloat(req.query.annual_volume as string) : undefined;
      const result = await service.compareFacilities({
        dosageForm: req.query.dosage_form as string,
        technology: req.query.technology as string,
        annualVolume
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // SIMPLIFIED ENGINE & DECISION REPORT (Workspaces B & C)
  // ==========================================

  static async quickEvaluate(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.quickEvaluate(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getComprehensiveAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.getComprehensiveAssessment(req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async recordDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new ProductionFeasibilityService(supabase, orgId, userId);
      const result = await service.recordFinalDecisionSnapshot(req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // FACILITY MULTI-SHEET DOCUMENT IMPORT (Workspace A)
  // ==========================================

  static async downloadFacilityTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = FacilityImportService.generateTemplateWorkbook();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="bdiq_facility_configuration_template.xlsx"');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  static async previewFacilityImport(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Please upload a valid Excel (.xlsx, .xls) or CSV file.' });
      }

      const service = new FacilityImportService(supabase, orgId, userId);
      const preview = await service.parseAndPreview(req.file.buffer, req.file.originalname);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  static async commitFacilityImport(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const { session_id } = req.body;
      if (!session_id) {
        return res.status(400).json({ error: 'session_id is required to commit import.' });
      }

      const service = new FacilityImportService(supabase, orgId, userId);
      const result = await service.commitImport(session_id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // AI PROVIDER & API KEY CONFIGURATION (Admin / System Settings)
  // ==========================================

  static async getAIConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new AIProviderService(supabase, orgId, userId);
      const config = await service.getConfig();
      res.json(config || {
        provider_name: 'OPENAI',
        provider_display_name: 'OpenAI GPT-4o Engine',
        model_name: 'gpt-4o',
        is_default: true,
        is_enabled: true,
        max_output_tokens: 4000,
        temperature: 0.2,
        last_test_status: 'NOT_TESTED',
        usage_count: 0
      });
    } catch (err) {
      next(err);
    }
  }

  static async saveAIConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new AIProviderService(supabase, orgId, userId);
      const saved = await service.saveConfig(req.body);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async testAIConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new AIProviderService(supabase, orgId, userId);
      const result = await service.testConnection();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async discoverAIModels(req: Request, res: Response, next: NextFunction) {
    try {
      const supabase = createSupabaseClientForUser(req);
      const orgId = req.userContext!.organization_id;
      const userId = req.user!.id;

      const service = new AIProviderService(supabase, orgId, userId);
      const providerName = req.query.provider_name as string | undefined;
      const endpoint = req.query.api_endpoint as string | undefined;
      const result = await service.discoverAvailableModels(providerName, endpoint);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

