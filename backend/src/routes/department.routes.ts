import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import {
  getDepartments,
  getDepartmentById,
  getDepartmentMembers,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  bulkDeleteDepartments,
  downloadDepartmentTemplate,
  bulkUploadDepartments,
} from '../controllers/department.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

router.use(requireAuth, loadUserContext);

// Template download
router.get('/template', downloadDepartmentTemplate);

// Bulk upload (supports both multipart file and JSON body)
router.post('/bulk-upload', upload.single('file'), bulkUploadDepartments);

// Bulk delete
router.post('/bulk-delete', bulkDeleteDepartments);

// Department Members
router.get('/:id/members', getDepartmentMembers);

// CRUD routes
router.get('/', getDepartments);
router.get('/:id', getDepartmentById);
router.post('/', createDepartment);
router.put('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);

export default router;
