import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import { getPermissions } from '../controllers/permission.controller';

const router = Router();

router.use(requireAuth, loadUserContext);

router.get('/', requirePermission('permissions.read'), getPermissions);

export default router;
