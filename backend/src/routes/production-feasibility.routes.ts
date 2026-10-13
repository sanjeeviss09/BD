import { Router } from 'express';
import multer from 'multer';
import { ProductionFeasibilityController } from '../controllers/production-feasibility.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

const router = Router();

// Protect all production routes with auth
router.use(requireAuth);

// -------------------------------------------------------------------
// 1. Production Feasibility Assessments (Legacy & Standard)
// -------------------------------------------------------------------
router.get(
  '/assessments',
  requirePermission('production.view'),
  ProductionFeasibilityController.getFeasibilityList
);

router.get(
  '/analytics',
  requirePermission('production.view'),
  ProductionFeasibilityController.getDashboardAnalytics
);

// -------------------------------------------------------------------
// 2. Simplified Engine: Quick Evaluate & Comprehensive Assessment (Workspaces B & C)
// -------------------------------------------------------------------
router.post(
  '/assessments/quick-evaluate',
  requirePermission('production.create'),
  ProductionFeasibilityController.quickEvaluate
);

router.get(
  '/assessments/:id/comprehensive',
  requirePermission('production.view'),
  ProductionFeasibilityController.getComprehensiveAssessment
);

router.post(
  '/assessments/:id/decision',
  requirePermission('production.finalize'),
  ProductionFeasibilityController.recordDecision
);

router.get(
  '/assessments/:id',
  requirePermission('production.view'),
  ProductionFeasibilityController.getFeasibilityById
);

router.post(
  '/assessments',
  requirePermission('production.create'),
  ProductionFeasibilityController.createFeasibility
);

router.patch(
  '/assessments/:id',
  requirePermission('production.edit'),
  ProductionFeasibilityController.updateFeasibility
);

router.post(
  '/assessments/:id/evaluate',
  requirePermission('production.edit'),
  ProductionFeasibilityController.evaluateFeasibility
);

router.post(
  '/assessments/:id/finalize',
  requirePermission('production.finalize'),
  ProductionFeasibilityController.finalizeFeasibility
);

router.post(
  '/assessments/:id/revise',
  requirePermission('production.create'),
  ProductionFeasibilityController.reviseFeasibility
);

router.post(
  '/assessments/:id/gaps/:gapId/create-task',
  requirePermission('production.edit'),
  ProductionFeasibilityController.convertGapToTask
);

router.get(
  '/assessments/:id/export',
  requirePermission('production.export'),
  ProductionFeasibilityController.exportFeasibility
);

// -------------------------------------------------------------------
// 3. Facility Multi-Sheet Import & Template Management (Workspace A)
// -------------------------------------------------------------------
router.get(
  '/facilities/template/download',
  requirePermission('production.view'),
  ProductionFeasibilityController.downloadFacilityTemplate
);

router.post(
  '/facilities/import/preview',
  requirePermission('production.manage_facilities'),
  upload.single('file'),
  ProductionFeasibilityController.previewFacilityImport
);

router.post(
  '/facilities/import/commit',
  requirePermission('production.manage_facilities'),
  ProductionFeasibilityController.commitFacilityImport
);

// -------------------------------------------------------------------
// 4. Centralized AI Provider Configuration & Testing (Admin / Settings)
// -------------------------------------------------------------------
router.get(
  '/ai-config',
  requirePermission('production.view'),
  ProductionFeasibilityController.getAIConfig
);

router.post(
  '/ai-config',
  requirePermission('production.manage_configuration'),
  ProductionFeasibilityController.saveAIConfig
);

router.post(
  '/ai-config/test',
  requirePermission('production.manage_configuration'),
  ProductionFeasibilityController.testAIConnection
);

// -------------------------------------------------------------------
// 5. Facilities, Lines, Equipment & Technologies Masters
// -------------------------------------------------------------------
router.get(
  '/facilities',
  requirePermission('production.view'),
  ProductionFeasibilityController.getFacilities
);

router.get(
  '/facilities/compare',
  requirePermission('production.view'),
  ProductionFeasibilityController.compareFacilities
);

router.get(
  '/facilities/:id',
  requirePermission('production.view'),
  ProductionFeasibilityController.getFacilityById
);

router.post(
  '/facilities',
  requirePermission('production.manage_facilities'),
  ProductionFeasibilityController.createFacility
);

router.patch(
  '/facilities/:id',
  requirePermission('production.manage_facilities'),
  ProductionFeasibilityController.updateFacility
);

router.get(
  '/lines',
  requirePermission('production.view'),
  ProductionFeasibilityController.getLines
);

router.post(
  '/facilities/:facilityId/lines',
  requirePermission('production.manage_facilities'),
  ProductionFeasibilityController.createLine
);

router.get(
  '/equipment',
  requirePermission('production.view'),
  ProductionFeasibilityController.getEquipment
);

router.post(
  '/equipment',
  requirePermission('production.manage_equipment'),
  ProductionFeasibilityController.createEquipment
);

router.get(
  '/technologies',
  requirePermission('production.view'),
  ProductionFeasibilityController.getTechnologies
);

router.post(
  '/technologies',
  requirePermission('production.manage_facilities'),
  ProductionFeasibilityController.createTechnology
);

router.get(
  '/capacity/allocations',
  requirePermission('production.manage_capacity'),
  ProductionFeasibilityController.getCapacityAllocations
);

export default router;
