import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { NVIDIAOrchestratorService } from '../services/nvidia-orchestrator.service';
import { ValidationError } from '../utils/errors';

export const checkNVIDIAHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';

    const orchestrator = new NVIDIAOrchestratorService(supabase, orgId, userId);
    const health = await orchestrator.checkHealth();
    res.json(health);
  } catch (error) {
    next(error);
  }
};

export const parseAndIndexDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';

    if (!req.file || !req.file.buffer) {
      throw new ValidationError('A document file is required for extraction.');
    }

    const documentType = req.body.document_type || 'FACILITY_SPEC';
    const orchestrator = new NVIDIAOrchestratorService(supabase, orgId, userId);

    const result = await orchestrator.ingestAndIndexDocument(
      req.file.buffer,
      req.file.originalname,
      documentType
    );

    res.json({
      success: true,
      documentId: result.documentId,
      fileName: req.file.originalname,
      parserUsed: result.parseResult.parserUsed,
      totalSections: result.parseResult.totalSections,
      indexedChunks: result.indexedChunks,
      sectionsPreview: result.parseResult.sections.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
};

export const retrieveEvidence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);
    const orgId = req.userContext?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.user?.id || 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';

    const { query, topK } = req.body;
    if (!query) throw new ValidationError('Search query is required.');

    const orchestrator = new NVIDIAOrchestratorService(supabase, orgId, userId);
    const evidence = await orchestrator.searchEnterpriseEvidence(query, topK ? Number(topK) : 5);
    res.json(evidence);
  } catch (error) {
    next(error);
  }
};
