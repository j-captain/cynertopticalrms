import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { listAudit, auditSummary } from '../controllers/auditController.js';

const router = Router();
router.use(protect, requireAdmin);
router.get('/', listAudit);
router.get('/summary', auditSummary);

export default router;