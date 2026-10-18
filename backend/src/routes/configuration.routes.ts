import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import {
  getPlatformHealth,
  getEffectiveSettings,
  getModuleSettings,
  updateModuleSettings,
  getPlatformFeatures,
  togglePlatformFeature,
  getConfigurationSnapshots,
  publishConfigurationSnapshot,
  rollbackConfigurationSnapshot,
  getConfigurationGroups,
  getConfigurationOptions,
  createConfigurationOption,
  updateConfigurationOption,
} from '../controllers/configuration.controller';

const router = Router();

// Authentication and Context resolution
router.use(requireAuth, loadUserContext);

// Real Platform Health & Diagnostics
router.get('/health', requirePermission('configuration.read'), getPlatformHealth);

// Effective Settings & Module Configurations
router.get('/effective', requirePermission('configuration.read'), getEffectiveSettings);
router.get('/modules/:moduleId', requirePermission('configuration.read'), getModuleSettings);
router.put('/modules/:moduleId', requirePermission('configuration.manage'), updateModuleSettings);

// Feature Registry Management
router.get('/features', requirePermission('configuration.read'), getPlatformFeatures);
router.put('/features/:featureId', requirePermission('configuration.manage'), togglePlatformFeature);

// Configuration Version Snapshots & Rollback
router.get('/snapshots', requirePermission('configuration.read'), getConfigurationSnapshots);
router.post('/snapshots/publish', requirePermission('configuration.manage'), publishConfigurationSnapshot);
router.post('/snapshots/:version/rollback', requirePermission('configuration.manage'), rollbackConfigurationSnapshot);

// Legacy Definition & Options Endpoints (Preserved for Backward Compatibility)
router.get('/groups', requirePermission('configuration.read'), getConfigurationGroups);
router.get('/definitions/:definitionId/options', requirePermission('configuration.read'), getConfigurationOptions);
router.post('/definitions/:definitionId/options', requirePermission('configuration.manage'), createConfigurationOption);
router.put('/options/:id', requirePermission('configuration.manage'), updateConfigurationOption);

export default router;
