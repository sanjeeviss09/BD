import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

// Fetch all configuration groups
export const getConfigurationGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;

    const { data, error } = await supabase
      .from('configuration_groups')
      .select('*, configuration_definitions(*)')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('category')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
};

// Fetch configuration options (values) for a specific definition, merged with system defaults
export const getConfigurationOptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const { definitionId } = req.params;

    const { data, error } = await supabase
      .from('configuration_options')
      .select('*')
      .eq('definition_id', definitionId)
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('sort_order');

    if (error) throw error;
    res.json(data);
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
    const orgId = req.userContext!.organization_id;
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
        is_system: false
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
    const orgId = req.userContext!.organization_id;
    const { id } = req.params;
    const validatedData = optionSchema.partial().parse(req.body);

    // Verify ownership and system flag
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
