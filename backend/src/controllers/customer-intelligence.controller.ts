import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSupabaseClientForUser } from '../db/supabase';
import { CustomerIntelligenceService } from '../services/customer-intelligence.service';
import { ValidationError } from '../utils/errors';

const discoverSchema = z.object({
  subject_type: z.enum(['PRODUCT', 'MOLECULE']),
  subject_id: z.string(),
  country_ids: z.array(z.string()).optional(),
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

    const candidates = await service.getCandidates({ subject_id: validatedData.subject_id });
    res.status(200).json({
      message: 'Discovery complete',
      discovered_count: candidates.length,
      candidates
    });
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
    const result = await service.getCandidateProfile(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCustomerCandidateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getCandidateProfile(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getEvidenceProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getEvidenceProof(req.params.id as string, req.params.evidenceId as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const verifyEvidence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const { status, notes } = req.body;
    if (!status) {
      throw new ValidationError('Verification status is required');
    }

    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.verifyEvidence(req.params.id as string, req.params.evidenceId as string, status, notes);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const generateAISynthesis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.generateAISynthesis(req.params.id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getConnectors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getConnectors();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getScoringConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const { orgId, userId } = getAuthInfo(req);
    
    const service = new CustomerIntelligenceService(supabase, orgId, userId);
    const result = await service.getScoringConfig();
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
