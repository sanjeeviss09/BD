import { Router } from 'express';
import {
  discoverCustomers,
  getCustomerCandidates,
  getCustomerCandidateById,
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
  '/candidates',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getCustomerCandidates
);

router.get(
  '/candidates/:id',
  requireAnyPermission(['customer_intelligence.view', 'customer_intelligence.read', 'customer_intelligence.manage']),
  getCustomerCandidateById
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
