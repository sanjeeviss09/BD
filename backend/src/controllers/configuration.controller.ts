import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { SettingsService } from '../services/settings.service';

/**
 * Creates an instance of SettingsService for the current request
 */
function getSettingsService(req: Request): SettingsService {
  const supabase = createSupabaseClientForUser(req);
  const orgId = req.userContext?.organization_id || '00000000-0000-0000-0000-000000000001';
  const userId = req.userContext?.id;
  return new SettingsService(supabase, orgId, userId);
}

// -----------------------------------------------------------------------------
// Real Platform Health & Status
// -----------------------------------------------------------------------------

export const getPlatformHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const health = await service.getPlatformHealth();
    res.json(health);
  } catch (error) {
    next(error);
  }
};

// -----------------------------------------------------------------------------
// Effective Settings & Module Configurations
// -----------------------------------------------------------------------------

export const getEffectiveSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const settings = await service.getEffectiveSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

export const getModuleSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const moduleId = Array.isArray(req.params.moduleId) ? req.params.moduleId[0] : req.params.moduleId;
    const settings = await service.getEffectiveSettings(moduleId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

export const updateModuleSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const moduleId = Array.isArray(req.params.moduleId) ? req.params.moduleId[0] : req.params.moduleId;
    const updated = await service.updateModuleSettings(moduleId, req.body);
    res.json({ success: true, module: moduleId, settings: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid configuration parameters', (error as any).errors));
    } else {
      next(error);
    }
  }
};

// -----------------------------------------------------------------------------
// Feature Registry & Dependency-Aware Feature Management
// -----------------------------------------------------------------------------

export const getPlatformFeatures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const features = await service.getFeatures();
    res.json(features);
  } catch (error) {
    next(error);
  }
};

const featureToggleSchema = z.object({
  is_enabled: z.boolean(),
});

export const togglePlatformFeature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const featureId = Array.isArray(req.params.featureId) ? req.params.featureId[0] : req.params.featureId;
    const { is_enabled } = featureToggleSchema.parse(req.body);
    const result = await service.toggleFeature(featureId, is_enabled);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid feature toggle data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

// -----------------------------------------------------------------------------
// Configuration Version Snapshots & Rollback
// -----------------------------------------------------------------------------

export const getConfigurationSnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const snapshots = await service.getSnapshots();
    res.json(snapshots);
  } catch (error) {
    next(error);
  }
};

const publishSnapshotSchema = z.object({
  change_summary: z.string().min(5, 'Change summary must be at least 5 characters long'),
  settings_overrides: z.record(z.string(), z.any()).optional(),
});

export const publishConfigurationSnapshot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const { change_summary, settings_overrides } = publishSnapshotSchema.parse(req.body);
    const published = await service.publishSnapshot(change_summary, settings_overrides);
    res.status(201).json({
      success: true,
      message: `Configuration version ${published.version} published successfully.`,
      snapshot: published,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid publish request data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const rollbackConfigurationSnapshot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getSettingsService(req);
    const versionStr = Array.isArray(req.params.version) ? req.params.version[0] : req.params.version;
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
      throw new ValidationError('Invalid snapshot version number specified.');
    }
    const restored = await service.rollbackSnapshot(version);
    res.json({
      success: true,
      message: `Successfully rolled back to configuration version ${version}. Created version ${restored.version}.`,
      snapshot: restored,
    });
  } catch (error) {
    next(error);
  }
};

// -----------------------------------------------------------------------------
// Legacy Options & Definitions Endpoints (Preserved for 100% Backward Compatibility)
// -----------------------------------------------------------------------------

export const getConfigurationGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || '00000000-0000-0000-0000-000000000001';

    const { data, error } = await supabase
      .from('configuration_groups')
      .select('*, configuration_definitions(*)')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('category')
      .order('name');

    if (error) {
      // Fallback empty list if table empty
      return res.json([]);
    }
    res.json(data || []);
  } catch (error) {
    next(error);
  }
};

export const getConfigurationOptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || '00000000-0000-0000-0000-000000000001';
    const { definitionId } = req.params;

    const { data, error } = await supabase
      .from('configuration_options')
      .select('*')
      .eq('definition_id', definitionId)
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('sort_order');

    if (error) {
      return res.json([]);
    }
    res.json(data || []);
  } catch (error) {
    next(error);
  }
};

const optionSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const createConfigurationOption = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || '00000000-0000-0000-0000-000000000001';
    const { definitionId } = req.params;
    const validatedData = optionSchema.parse(req.body);

    const { data, error } = await supabase
      .from('configuration_options')
      .insert({
        organization_id: orgId,
        definition_id: definitionId,
        key: validatedData.key,
        label: validatedData.label,
        description: validatedData.description,
        sort_order: validatedData.sort_order || 0,
        is_active: validatedData.is_active !== undefined ? validatedData.is_active : true,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid configuration option data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const updateConfigurationOption = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;
    const validatedData = optionSchema.partial().parse(req.body);

    const { data: optionCheck } = await supabase.from('configuration_options').select('*').eq('id', id).single();
    if (!optionCheck) throw new NotFoundError('Option not found');
    if (optionCheck.is_system) throw new ForbiddenError('Cannot modify system options');
    if (optionCheck.organization_id !== orgId) throw new ForbiddenError('Cannot modify cross-org options');

    const { data, error } = await supabase
      .from('configuration_options')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid configuration option data', (error as any).errors));
    } else {
      next(error);
    }
  }
};
