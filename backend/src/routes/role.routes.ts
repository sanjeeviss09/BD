import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import { getRoles, createRole, updateRole } from '../controllers/role.controller';

const router = Router();

router.use(requireAuth, loadUserContext);

router.get('/', requirePermission('roles.read'), getRoles);
router.post('/', requirePermission('roles.manage'), createRole);
router.put('/:id', requirePermission('roles.manage'), updateRole);

export default router;
