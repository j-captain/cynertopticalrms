import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listCodes,
  lookupCode,
  createCode,
  updateCode,
  deleteCode,
} from '../controllers/icd11Controller.js';

const router = Router();
router.use(protect);

router.get('/', listCodes);
router.get('/lookup', lookupCode);
router.post('/', requireAdmin, createCode);
router.put('/:id', requireAdmin, updateCode);
router.delete('/:id', requireAdmin, deleteCode);

export default router;