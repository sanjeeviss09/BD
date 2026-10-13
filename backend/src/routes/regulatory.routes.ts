import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import { RegulatoryController } from '../controllers/regulatory.controller';

const router = Router();
const regulatoryController = new RegulatoryController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Regulatory Sources & Authorities
router.get('/sources', requireAuth, loadUserContext, regulatoryController.getSources);
router.get('/authorities', requireAuth, loadUserContext, regulatoryController.getAuthorities);
router.get('/datasets', requireAuth, loadUserContext, regulatoryController.getDatasets);

// Regulatory Records & Lineage
router.get('/records', requireAuth, loadUserContext, regulatoryController.getRecords);
router.get('/records/:id', requireAuth, loadUserContext, regulatoryController.getRecord);
router.get('/lineage/:id', requireAuth, loadUserContext, regulatoryController.getRecordLineage);

// Entity Matching Resolution
router.post('/matches/:id/resolve', requireAuth, loadUserContext, regulatoryController.resolveMatch);

// Product Regulatory Profile & Assessments
router.get('/products/:productId', requireAuth, loadUserContext, regulatoryController.getProductProfile);
router.get('/export/:productId', requireAuth, loadUserContext, regulatoryController.exportProfile);

// Assessments & Opportunity Linking
router.post('/assessments', requireAuth, loadUserContext, regulatoryController.createAssessment);
router.get('/assessments/product/:productId', requireAuth, loadUserContext, regulatoryController.getAssessmentsForProduct);
router.get('/assessments/opportunity/:opportunityId', requireAuth, loadUserContext, regulatoryController.getAssessmentsForOpportunity);

// Global Analytics
router.get('/analytics', requireAuth, loadUserContext, regulatoryController.getAnalytics);

// Authorized File Ingestion
router.post('/import', requireAuth, loadUserContext, upload.single('file'), regulatoryController.importFile);

export default router;
