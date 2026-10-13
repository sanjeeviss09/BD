import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSupabaseClientForUser } from '../db/supabase';
import { CustomerIntelligenceService } from '../services/customer-intelligence.service';
import { ValidationError } from '../utils/errors';

const discoverSchema = z.object({
  subject_type: z.enum(['PRODUCT', 'MOLECULE']),
  subject_id: z.string().uuid(),
  country_ids: z.array(z.string().uuid()).optional(),
  customer_types: z.array(z.string()).optional()
});

const getAuthInfo = (req: Request) => {
  const orgId = req.userContext?.organization_id || (req as any).user?.organization_id || 'a0000000-0000-0000-0000-000000000001';
  const userId = req.user?.id || req.userContext?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
  return { orgId, userId };
};

export const discoverCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);

    const validatedData = discoverSchema.parse(req.body);
    const service = new CustomerIntelligenceService(supabase, orgId, userId);

    const candidates = await service.discoverCustomers(validatedData);
    res.status(200).json(candidates);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid discovery criteria', (error as any).issues));
    } else {
      next(error);
    }
  }
};

export const getCustomerCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getCandidates(req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCustomerCandidateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getCandidateById(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const statusUpdateSchema = z.object({
  reason: z.string().optional()
});

export const qualifyCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const validatedData = statusUpdateSchema.parse(req.body);
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    
    const result = await service.updateCandidateStatus(req.params.id as string, 'QUALIFIED', validatedData.reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const shortlistCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const validatedData = statusUpdateSchema.parse(req.body);
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    
    const result = await service.updateCandidateStatus(req.params.id as string, 'SHORTLISTED', validatedData.reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const disqualifyCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const validatedData = statusUpdateSchema.parse(req.body);
    if (!validatedData.reason) {
      throw new ValidationError('Reason is required for disqualification');
    }

    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.updateCandidateStatus(req.params.id as string, 'DISQUALIFIED', validatedData.reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
