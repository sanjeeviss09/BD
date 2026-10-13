import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import { CommercialEvaluationController } from '../controllers/commercial-evaluation.controller';

const router = Router();
const controller = new CommercialEvaluationController();

// Analytics & Lists
router.get('/analytics', requireAuth, loadUserContext, controller.getAnalytics);
router.get('/', requireAuth, loadUserContext, controller.getEvaluations);
router.post('/', requireAuth, loadUserContext, controller.createEvaluation);

// Single Evaluation CRUD
router.get('/:id', requireAuth, loadUserContext, controller.getEvaluation);
router.patch('/:id', requireAuth, loadUserContext, controller.updateEvaluation);

// Costing & Pricing Updates
router.put('/:id/costs', requireAuth, loadUserContext, controller.updateCostComponents);
router.put('/:id/pricing', requireAuth, loadUserContext, controller.updatePricing);

// Finalize & Versioning
router.post('/:id/finalize', requireAuth, loadUserContext, controller.finalizeEvaluation);
router.post('/:id/versions', requireAuth, loadUserContext, controller.createNewVersion);

// Export
router.get('/:id/export', requireAuth, loadUserContext, controller.exportDossier);

export default router;
