import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import multer from 'multer';
import * as marketDataController from '../controllers/market-data.controller';

const router = Router();

// Configure multer for memory storage and file size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  },
});

// Import Session routes
router.post(
  '/import-sessions',
  requireAuth,
  requirePermission('market_data.import'),
  upload.single('file'),
  marketDataController.createImportSession
);

router.get(
  '/import-sessions/:id',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.getImportSession
);

router.post(
  '/import-sessions/:id/inspect',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.inspectImportSession
);

router.post(
  '/import-sessions/:id/select-sheet',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.selectSheet
);

router.post(
  '/import-sessions/:id/mapping',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.saveMapping
);

router.post(
  '/import-sessions/:id/validate',
  requireAuth,
  requirePermission('market_data.validate'),
  marketDataController.validateImportSession
);

router.get(
  '/import-sessions/:id/quality',
  requireAuth,
  requirePermission('market_data.validate'),
  marketDataController.getQuality
);

router.get(
  '/import-sessions/:id/matches',
  requireAuth,
  requirePermission('market_data.validate'),
  marketDataController.getMatches
);

router.post(
  '/import-sessions/:id/confirm',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.confirmImport
);

router.post(
  '/import-sessions/:id/import',
  requireAuth,
  requirePermission('market_data.import'),
  marketDataController.processImport
);

router.get(
  '/datasets',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.listDatasets
);

router.get(
  '/datasets/:id/provenance',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.getDatasetProvenance
);

router.get(
  '/datasets/:datasetVersionId/diagnostics',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.getDiagnostics
);

router.post(
  '/analysis',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.runAnalysis
);

router.post(
  '/analysis/country/:iso',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.getCountryDeepDive
);

router.post(
  '/export',
  requireAuth,
  requirePermission('market_data.read'),
  marketDataController.exportAnalysis
);

export default router;
