import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';
import {
  checkNVIDIAHealth,
  parseAndIndexDocument,
  retrieveEvidence,
} from '../controllers/ai-orchestrator.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB document limit
});

const router = Router();

router.use(requireAuth, loadUserContext);

// 1. Health check & status across all 3 NVIDIA capabilities
router.get('/health', checkNVIDIAHealth);

// 2. Document Parsing with Nemotron Parse / native parsers & automatic indexing
router.post('/parse-document', upload.single('file'), parseAndIndexDocument);

// 3. NeMo Retriever semantic evidence search
router.post('/retrieve', retrieveEvidence);

export default router;
