import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import { ResponsibilityController } from '../controllers/responsibility.controller';

const router = Router();
const controller = new ResponsibilityController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(requireAuth, loadUserContext);

// Public query & resolution (accessible to normal users for task creation/preview)
router.get('/rules', controller.listRules);
router.get('/rules/:id', controller.getRule);
router.get('/rules/:id/history', controller.getAuditHistory);
router.post('/resolve', controller.resolveResponsibility);
router.get('/conflicts', controller.detectConflicts);
router.get('/matrix', controller.getMatrixView);
router.get('/departments/:departmentId/members', controller.getDepartmentMembers);

// Export & Import
router.get('/export', controller.exportRulesToExcel);
router.post('/import', requirePermission('configuration.manage'), upload.single('file'), controller.importRulesFromExcel);

// Mutation endpoints (Requires manage permission)
router.post('/rules', requirePermission('configuration.manage'), controller.createRule);
router.put('/rules/:id', requirePermission('configuration.manage'), controller.updateRule);
router.post('/rules/:id/duplicate', requirePermission('configuration.manage'), controller.duplicateRule);
router.post('/rules/:id/deactivate', requirePermission('configuration.manage'), controller.deactivateRule);

export default router;
