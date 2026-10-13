import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import { getMe } from '../controllers/auth.controller';

const router = Router();

// /api/auth/me returns the current user profile and effective permissions
router.get('/me', requireAuth, loadUserContext, getMe);

export default router;
