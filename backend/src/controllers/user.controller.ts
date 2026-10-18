import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { UserUploadService } from '../services/user-upload.service';
import { DepartmentService } from '../services/department.service';
import { logger } from '../utils/logger';

const flexibleId = z.string().optional().nullable().transform(val => {
  if (!val || typeof val !== 'string' || val.trim() === '' || val === 'ALL' || val === 'unassigned') return null;
  return val.trim();
});

const userSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  employee_code: z.string().optional().nullable().transform(v => v?.trim() || undefined),
  department_id: flexibleId,
  team_id: flexibleId,
  location_id: flexibleId,
  designation: z.string().optional().nullable().transform(v => v?.trim() || undefined),
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

    // Resolve department info if department_id is supplied
    let deptInfo: { name: string; code?: string } | undefined = undefined;
    if (validatedData.department_id) {
      const matchedDept = DepartmentService.fallbackDepartments.find(d => d.id === validatedData.department_id);
      if (matchedDept) {
        deptInfo = { name: matchedDept.name, code: matchedDept.code };
      }
    }

    const newRecord: any = {
      id: crypto.randomUUID(),
      ...validatedData,
      organization_id: orgId,
      status: validatedData.status || 'ACTIVE',
      departments: deptInfo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: newRecord.id,
          organization_id: orgId,
          full_name: validatedData.full_name,
          email: validatedData.email,
          employee_code: validatedData.employee_code,
          department_id: validatedData.department_id,
          team_id: validatedData.team_id,
          location_id: validatedData.location_id,
          designation: validatedData.designation,
          status: validatedData.status || 'ACTIVE',
        })
        .select('*, departments(name, code)')
        .single();

      if (!error && data) {
        UserUploadService.fallbackUsers.unshift(data);
        return res.status(201).json(data);
      }
    } catch (dbErr: any) {
      logger.warn('Failed to insert user into DB, continuing with local store', { error: dbErr.message });
    }

    UserUploadService.fallbackUsers.unshift(newRecord);
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
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const validatedData = userSchema.partial().parse(req.body);

    // Resolve department details if department_id was modified
    let deptInfo: { name: string; code?: string } | undefined | null = undefined;
    if (validatedData.department_id) {
      const matchedDept = DepartmentService.fallbackDepartments.find(d => d.id === validatedData.department_id);
      if (matchedDept) {
        deptInfo = { name: matchedDept.name, code: matchedDept.code };
      }
    } else if (validatedData.department_id === null) {
      deptInfo = null;
    }

    // Try updating database
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .eq('id', id)
        .select('*, departments(name, code)')
        .maybeSingle();

      if (!error && data) {
        // Synchronize in-memory fallback store
        const idx = UserUploadService.fallbackUsers.findIndex(u => u.id === id);
        if (idx >= 0) {
          UserUploadService.fallbackUsers[idx] = { ...UserUploadService.fallbackUsers[idx], ...data };
        } else {
          UserUploadService.fallbackUsers.unshift(data);
        }
        return res.json(data);
      }
    } catch (dbErr: any) {
      logger.warn('Failed to update user in DB, synchronizing local fallback store', { error: dbErr.message });
    }

    // Update in-memory store if DB had 0 rows or encountered an error
    const idx = UserUploadService.fallbackUsers.findIndex(u => u.id === id);
    if (idx >= 0) {
      const existing = UserUploadService.fallbackUsers[idx];
      const finalDept = deptInfo !== undefined ? (deptInfo || undefined) : existing.departments;
      const updatedUser = {
        ...existing,
        ...validatedData,
        departments: finalDept,
        updated_at: new Date().toISOString(),
      };
      UserUploadService.fallbackUsers[idx] = updatedUser;
      return res.json(updatedUser);
    }

    throw new NotFoundError(`Employee with ID ${id} not found.`);
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
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    try {
      await supabase
        .from('user_profiles')
        .delete()
        .eq('organization_id', orgId)
        .eq('id', id);
    } catch {
      // Fallback update status if delete blocked by foreign key
      await supabase
        .from('user_profiles')
        .update({ status: 'INACTIVE' })
        .eq('organization_id', orgId)
        .eq('id', id);
    }

    UserUploadService.fallbackUsers = UserUploadService.fallbackUsers.filter(u => u.id !== id);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteUsersSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one ID is required'),
});

export const bulkDeleteUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const { ids } = bulkDeleteUsersSchema.parse(req.body);

    try {
      await supabase
        .from('user_profiles')
        .delete()
        .eq('organization_id', orgId)
        .in('id', ids);
    } catch {
      // Fallback to updating status
      await supabase
        .from('user_profiles')
        .update({ status: 'INACTIVE' })
        .eq('organization_id', orgId)
        .in('id', ids);
    }

    UserUploadService.fallbackUsers = UserUploadService.fallbackUsers.filter(u => !ids.includes(u.id));

    res.json({ success: true, count: ids.length, deletedIds: ids });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid delete payload', (error as any).errors));
    } else {
      next(error);
    }
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

