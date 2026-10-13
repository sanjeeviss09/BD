import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import { RFQController } from '../controllers/rfq.controller';

const router = Router();
const rfqController = new RFQController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Template routes
router.get('/templates', requireAuth, loadUserContext, rfqController.getTemplates);
router.post('/templates', requireAuth, loadUserContext, rfqController.createTemplate);
router.get('/templates/:id', requireAuth, loadUserContext, rfqController.getTemplate);
router.patch('/templates/:id', requireAuth, loadUserContext, rfqController.updateTemplate);
router.post('/templates/inspect', requireAuth, loadUserContext, upload.single('file'), rfqController.inspectTemplateFile);

// Core RFQ CRUD
router.get('/', requireAuth, loadUserContext, rfqController.getRFQs);
router.post('/', requireAuth, loadUserContext, rfqController.createRFQ);
router.get('/:id', requireAuth, loadUserContext, rfqController.getRFQ);
router.patch('/:id', requireAuth, loadUserContext, rfqController.updateRFQ);

// Import / Export
router.post('/import', requireAuth, loadUserContext, upload.single('file'), rfqController.importRFQFile);
router.post('/export', requireAuth, loadUserContext, rfqController.exportRFQ);
router.get('/:id/export', requireAuth, loadUserContext, (req, res, next) => {
  req.query.id = req.params.id;
  rfqController.exportRFQ(req, res, next);
});

// RFQ Lifecycle & Extended Actions
router.post('/:id/validate', requireAuth, loadUserContext, rfqController.validateRFQ);
router.get('/:id/revisions', requireAuth, loadUserContext, rfqController.getRevisions);
router.post('/:id/revisions', requireAuth, loadUserContext, rfqController.createRevision);
router.get('/:id/clarifications', requireAuth, loadUserContext, rfqController.getClarifications);
router.post('/:id/clarifications', requireAuth, loadUserContext, rfqController.createClarification);
router.post('/:id/tasks', requireAuth, loadUserContext, rfqController.createTask);
router.get('/:id/timeline', requireAuth, loadUserContext, rfqController.getTimeline);
router.get('/:id/audit', requireAuth, loadUserContext, rfqController.getAudit);

// Assessments
router.get('/:id/assessments/:type', requireAuth, loadUserContext, rfqController.getAssessments);
router.post('/:id/assessments/:type', requireAuth, loadUserContext, rfqController.updateAssessment);

// Quotation & Status Transitions
router.post('/:id/quotation', requireAuth, loadUserContext, rfqController.createQuotation);
router.post('/:id/submit', requireAuth, loadUserContext, rfqController.submitQuotation);
router.post('/:id/hold', requireAuth, loadUserContext, rfqController.holdRFQ);
router.post('/:id/win', requireAuth, loadUserContext, rfqController.winRFQ);
router.post('/:id/lost', requireAuth, loadUserContext, rfqController.loseRFQ);

export default router;
