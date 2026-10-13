import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRoles,
  downloadUserTemplate,
  bulkUploadUsers,
} from '../controllers/user.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

router.use(requireAuth, loadUserContext);

// Template download
router.get('/template', downloadUserTemplate);

// Bulk upload (supports both multipart file and JSON body)
router.post('/bulk-upload', upload.single('file'), bulkUploadUsers);

router.get('/', requirePermission('users.read'), getUsers);
router.get('/:id', requirePermission('users.read'), getUserById);
router.post('/', requirePermission('users.create'), createUser);
router.put('/:id', requirePermission('users.update'), updateUser);
router.delete('/:id', requirePermission('users.disable'), deleteUser);
router.put('/:id/roles', requirePermission('users.manage'), assignRoles);

export default router;
