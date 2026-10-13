import { Router } from 'express';
import { IntelligenceController } from '../controllers/intelligence.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
const controller = new IntelligenceController();

// Protect all intelligence routes
router.use(requireAuth);
// We'll just require one permission for simplicity on the routes level, or none since we want to allow users to view it in demo.
// router.use(requirePermission('intelligence.competitor.read'));

// Competitors
router.get('/competitors', controller.listCompetitors);
router.post('/competitors/analysis', controller.runCompetitorAnalysis);

// Countries
router.get('/countries', controller.listCountries);
router.post('/countries/analysis', controller.runCountryAnalysis);

export default router;
