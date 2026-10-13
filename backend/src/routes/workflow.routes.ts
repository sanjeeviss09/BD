import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import { WorkflowController } from '../controllers/workflow.controller';

const router = Router();

// Apply authentication and user context resolution to all workflow endpoints
router.use(requireAuth, loadUserContext);

// 1. Workflow Definitions
router.get(
  '/definitions',
  requirePermission('workflow.read'),
  WorkflowController.listDefinitions
);

router.get(
  '/definitions/:id',
  requirePermission('workflow.read'),
  WorkflowController.getDefinition
);

router.post(
  '/definitions',
  requirePermission('workflow.manage'),
  WorkflowController.createDefinition
);

// 2. Workflow Versions
router.get(
  '/definitions/:definitionId/versions',
  requirePermission('workflow.read'),
  WorkflowController.listVersions
);

router.get(
  '/versions/:versionId',
  requirePermission('workflow.read'),
  WorkflowController.getVersion
);

router.post(
  '/definitions/:definitionId/versions',
  requirePermission('workflow.manage'),
  WorkflowController.createVersion
);

router.post(
  '/versions/:versionId/validate',
  requirePermission('workflow.manage'),
  WorkflowController.validateVersion
);

router.post(
  '/versions/:versionId/activate',
  requirePermission('workflow.manage'),
  WorkflowController.activateVersion
);

// 3. Stages & Transitions Configuration
router.post(
  '/versions/:versionId/stages',
  requirePermission('workflow.manage'),
  WorkflowController.createStage
);

router.post(
  '/versions/:versionId/transitions',
  requirePermission('workflow.manage'),
  WorkflowController.createTransition
);

// 4. Operational Opportunity Workflow Lifecycle
router.get(
  '/opportunities/:opportunityId/instance',
  requirePermission('workflow.read'),
  WorkflowController.getOpportunityInstance
);

router.get(
  '/opportunities/:opportunityId/valid-transitions',
  requirePermission('workflow.read'),
  WorkflowController.getValidTransitions
);

router.post(
  '/opportunities/:opportunityId/transition',
  requirePermission('workflow.execute'),
  WorkflowController.executeTransition
);

router.post(
  '/opportunities/:opportunityId/reassign',
  requirePermission('workflow.assign'),
  WorkflowController.reassignStageOwner
);

router.get(
  '/opportunities/:opportunityId/history',
  requirePermission('workflow.history'),
  WorkflowController.getOpportunityHistory
);

// 5. Workflow Analytics
router.get(
  '/analytics',
  requirePermission('workflow.analytics'),
  WorkflowController.getWorkflowAnalytics
);

export default router;
