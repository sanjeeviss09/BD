import { Router } from 'express';
import { OpportunityController } from '../controllers/opportunity.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Enforce authentication & user context
router.use(requireAuth);
router.use(loadUserContext);

// --- Metadata & Reference Endpoints ---
router.get(
  '/references/stages',
  requirePermission('opportunities.read'),
  OpportunityController.getStages
);
router.get(
  '/references/criteria',
  requirePermission('opportunities.read'),
  OpportunityController.getCriteria
);

// --- Pipeline Analytics & Export ---
router.get(
  '/analytics',
  requirePermission('opportunities.analytics'),
  OpportunityController.getAnalytics
);
router.get(
  '/export',
  requirePermission('opportunities.export'),
  OpportunityController.exportOpportunities
);

// --- Opportunity Operations ---
router.post(
  '/',
  requirePermission('opportunities.create'),
  OpportunityController.createOpportunity
);
router.get(
  '/',
  requirePermission('opportunities.read'),
  OpportunityController.getOpportunities
);
router.get(
  '/:id',
  requirePermission('opportunities.read'),
  OpportunityController.getOpportunityById
);
router.patch(
  '/:id',
  requirePermission('opportunities.update'),
  OpportunityController.updateOpportunity
);
router.post(
  '/:id/stage',
  requirePermission('opportunities.stage'),
  OpportunityController.transitionStage
);
router.post(
  '/:id/qualify',
  requirePermission('opportunities.qualify'),
  OpportunityController.recordQualification
);
router.post(
  '/:id/close',
  requirePermission('opportunities.close'),
  OpportunityController.closeOpportunity
);
router.post(
  '/:id/reopen',
  requirePermission('opportunities.reopen'),
  OpportunityController.reopenOpportunity
);

// --- Sub-Entity Associations ---
// Products
router.post(
  '/:id/products',
  requirePermission('opportunities.update'),
  OpportunityController.addProduct
);
router.delete(
  '/:id/products/:productId',
  requirePermission('opportunities.update'),
  OpportunityController.removeProduct
);

// Markets / Countries
router.post(
  '/:id/markets',
  requirePermission('opportunities.update'),
  OpportunityController.addMarket
);
router.delete(
  '/:id/markets/:marketId',
  requirePermission('opportunities.update'),
  OpportunityController.removeMarket
);

// Risks
router.post(
  '/:id/risks',
  requirePermission('opportunities.risk'),
  OpportunityController.addRisk
);
router.delete(
  '/:id/risks/:riskId',
  requirePermission('opportunities.risk'),
  OpportunityController.deleteRisk
);

// Requirements
router.post(
  '/:id/requirements',
  requirePermission('opportunities.update'),
  OpportunityController.addRequirement
);
router.delete(
  '/:id/requirements/:reqId',
  requirePermission('opportunities.update'),
  OpportunityController.deleteRequirement
);

// Comments
router.post(
  '/:id/comments',
  requirePermission('opportunities.read'),
  OpportunityController.addComment
);

export default router;
