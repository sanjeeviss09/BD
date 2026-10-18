import { Router } from 'express';
import {
  discoverCustomers,
  getCustomerCandidates,
  getCustomerCandidateById,
  getCustomerCandidateProfile,
  getEvidenceProof,
  verifyEvidence,
  generateAISynthesis,
  getConnectors,
  getScoringConfig,
  qualifyCandidate,
  shortlistCandidate,
  disqualifyCandidate
} from '../controllers/customer-intelligence.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requireAnyPermission } from '../middleware/permission.middleware';

const router = Router();

router.use(requireAuth);
router.use(loadUserContext);

router.post(
  '/discover',
  requireAnyPermission(['customer_intelligence.discover', 'customer_intelligence.create', 'customer_intelligence.manage']),
  discoverCustomers
);

router.get(
  '/connectors',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getConnectors
);

router.get(
  '/scoring-config',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getScoringConfig
);

router.get(
  '/candidates',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getCustomerCandidates
);

router.get(
  '/candidates/:id',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getCustomerCandidateById
);

router.get(
  '/candidates/:id/profile',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getCustomerCandidateProfile
);

router.get(
  '/candidates/:id/evidence/:evidenceId',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getEvidenceProof
);

router.post(
  '/candidates/:id/evidence/:evidenceId/verify',
  requireAnyPermission(['customer_intelligence.update', 'customer_intelligence.manage']),
  verifyEvidence
);

router.post(
  '/candidates/:id/verify-evidence',
  requireAnyPermission(['customer_intelligence.update', 'customer_intelligence.manage']),
  (req, res, next) => {
    if (req.body?.evidenceId && !req.params?.evidenceId) {
      req.params.evidenceId = req.body.evidenceId;
    }
    return verifyEvidence(req, res, next);
  }
);

router.post(
  '/candidates/:id/ai-synthesis',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  generateAISynthesis
);

router.post(
  '/candidates/:id/qualify',
  requireAnyPermission(['customer_intelligence.qualify', 'customer_intelligence.update', 'customer_intelligence.manage']),
  qualifyCandidate
);

router.post(
  '/candidates/:id/shortlist',
  requireAnyPermission(['customer_intelligence.shortlist', 'customer_intelligence.update', 'customer_intelligence.manage']),
  shortlistCandidate
);

router.post(
  '/candidates/:id/disqualify',
  requireAnyPermission(['customer_intelligence.manage', 'customer_intelligence.update']),
  disqualifyCandidate
);

export default router;
