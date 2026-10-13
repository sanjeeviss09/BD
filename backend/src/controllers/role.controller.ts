import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;

    // Fetch system roles (org = null) and org roles
    const { data, error } = await supabase
      .from('roles')
      .select('*, role_permissions(permissions(*))')
      .or(`organization_id.eq.${orgId},organization_id.is.null`);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const roleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  permission_ids: z.array(z.string().uuid()).optional()
});

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const validatedData = roleSchema.parse(req.body);

    const { data, error } = await supabase
      .from('roles')
      .insert({
        organization_id: orgId,
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description,
        status: validatedData.status || 'ACTIVE',
        system_role: false
      })
      .select()
      .single();

    if (error) throw error;

    if (validatedData.permission_ids && validatedData.permission_ids.length > 0) {
      const rpData = validatedData.permission_ids.map(pid => ({
        role_id: data.id,
        permission_id: pid
      }));
      await supabase.from('role_permissions').insert(rpData);
    }

    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid role data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const { id } = req.params;
    const validatedData = roleSchema.partial().parse(req.body);

    // Ensure it's not a system role
    const { data: roleCheck } = await supabase.from('roles').select('system_role, organization_id').eq('id', id).single();
    if (!roleCheck) throw new NotFoundError('Role not found');
    if (roleCheck.system_role) throw new ForbiddenError('Cannot modify system roles');
    if (roleCheck.organization_id !== orgId) throw new ForbiddenError('Cannot modify cross-org roles');

    const updatePayload: any = {};
    if (validatedData.name) updatePayload.name = validatedData.name;
    if (validatedData.description) updatePayload.description = validatedData.description;
    if (validatedData.status) updatePayload.status = validatedData.status;

    const { data, error } = await supabase
      .from('roles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (validatedData.permission_ids) {
      // Replace permissions
      await supabase.from('role_permissions').delete().eq('role_id', id);
      if (validatedData.permission_ids.length > 0) {
        const rpData = validatedData.permission_ids.map(pid => ({
          role_id: id,
          permission_id: pid
        }));
        await supabase.from('role_permissions').insert(rpData);
      }
    }

    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid role data', (error as any).errors));
    } else {
      next(error);
    }
  }
};
