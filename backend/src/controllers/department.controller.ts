import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { DepartmentService } from '../services/department.service';
import { ValidationError } from '../utils/errors';
import { z } from 'zod';

const createDepartmentSchema = z.object({
  code: z.string().min(1, 'Department code is required'),
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

export const getDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const filters = {
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };

    const data = await service.getDepartments(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const data = await service.getDepartmentById(req.params.id as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getDepartmentMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const data = await service.getDepartmentMembers(req.params.id as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const validated = createDepartmentSchema.parse(req.body);
    const data = await service.createDepartment(validated);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid department data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const validated = updateDepartmentSchema.parse(req.body);
    const data = await service.updateDepartment(req.params.id as string, validated);
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid department update data', (error as any).errors));
    } else {
      next(error);
    }
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const result = await service.deleteDepartment(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const downloadDepartmentTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    const buffer = service.generateExcelTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="BDIQ_Departments_Template.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const bulkUploadDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
    const service = new DepartmentService(supabase, orgId, userId);

    let payload: any;
    if (req.file && req.file.buffer) {
      payload = req.file.buffer;
    } else if (req.body && (Array.isArray(req.body) || Array.isArray(req.body.departments))) {
      payload = Array.isArray(req.body) ? req.body : req.body.departments;
    } else {
      throw new ValidationError('No file or department records provided for bulk upload.');
    }

    const result = await service.bulkUpload(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
