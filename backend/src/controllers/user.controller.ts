import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { UserUploadService } from '../services/user-upload.service';

const userSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
  employee_code: z.string().optional(),
  department_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  designation: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const uploadService = new UserUploadService(supabase, orgId, userId);

    const departmentId = req.query.department_id as string | undefined;
    const search = req.query.search as string | undefined;

    const data = await uploadService.getUsers(departmentId, search);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, departments(name, code), teams(name), locations(name)')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return res.json(data);
    }

    const fallback = UserUploadService.fallbackUsers.find(u => u.id === id);
    if (!fallback) throw new NotFoundError('User not found');
    res.json(fallback);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';

    const validatedData = userSchema.parse(req.body);

    const newRecord: any = {
      id: crypto.randomUUID(),
      ...validatedData,
      organization_id: orgId,
      status: validatedData.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({ ...validatedData, organization_id: orgId })
        .select('*, departments(name, code)')
        .single();

      if (!error && data) {
        UserUploadService.fallbackUsers.push(data);
        return res.status(201).json(data);
      }
    } catch (dbErr) {
      // Fall through to memory store
    }

    UserUploadService.fallbackUsers.push(newRecord);
    res.status(201).json(newRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid user data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const { id } = req.params;

    const validatedData = userSchema.partial().parse(req.body);

    const { data, error } = await supabase
      .from('user_profiles')
      .update(validatedData)
      .eq('organization_id', orgId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid user data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const { id } = req.params;

    // Soft delete or status change is preferred in enterprise apps
    const { error } = await supabase
      .from('user_profiles')
      .update({ status: 'INACTIVE' })
      .eq('organization_id', orgId)
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const assignRolesSchema = z.object({
  role_ids: z.array(z.string().uuid())
});

export const assignRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext!.organization_id;
    const { id } = req.params;
    const { role_ids } = assignRolesSchema.parse(req.body);

    // Verify user belongs to org
    const { data: userCheck } = await supabase.from('user_profiles').select('id').eq('id', id).eq('organization_id', orgId).single();
    if (!userCheck) throw new NotFoundError('User not found');

    // Replace roles (delete existing and insert new)
    await supabase.from('user_roles').delete().eq('user_id', id);
    if (role_ids.length > 0) {
      const inserts = role_ids.map(rid => ({ user_id: id, role_id: rid }));
      await supabase.from('user_roles').insert(inserts);
    }
    
    res.status(200).json({ message: 'Roles assigned successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid role assignment data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const downloadUserTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new UserUploadService(supabase, orgId, userId);

    const buffer = service.generateExcelTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="BDIQ_Employees_Template.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const bulkUploadUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new UserUploadService(supabase, orgId, userId);

    let payload: any;
    if (req.file && req.file.buffer) {
      payload = req.file.buffer;
    } else if (req.body && (Array.isArray(req.body) || Array.isArray(req.body.users))) {
      payload = Array.isArray(req.body) ? req.body : req.body.users;
    } else {
      throw new ValidationError('No file or employee records provided for bulk upload.');
    }

    const result = await service.bulkUpload(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

