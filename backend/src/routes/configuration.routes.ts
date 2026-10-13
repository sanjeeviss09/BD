import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import { 
  getConfigurationGroups, 
  getConfigurationOptions, 
  createConfigurationOption, 
  updateConfigurationOption 
} from '../controllers/configuration.controller';

const router = Router();

router.use(requireAuth, loadUserContext);

router.get('/groups', requirePermission('configuration.read'), getConfigurationGroups);
router.get('/definitions/:definitionId/options', requirePermission('configuration.read'), getConfigurationOptions);
router.post('/definitions/:definitionId/options', requirePermission('configuration.manage'), createConfigurationOption);
router.put('/options/:id', requirePermission('configuration.manage'), updateConfigurationOption);

export default router;
