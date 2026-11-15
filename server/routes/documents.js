import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listAllDocuments } from '../controllers/documentController.js';

const router = Router();
router.use(protect);
router.get('/', listAllDocuments);

export default router;