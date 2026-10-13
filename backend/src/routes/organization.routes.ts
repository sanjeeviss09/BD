import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getOrganizations, createOrganization } from '../controllers/organization.controller';

const router = Router();

// Protect all organization routes
router.use(requireAuth);

router.get('/', getOrganizations);
router.post('/', createOrganization);

export default router;
