import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listLensTypes,
  createLensType,
  updateLensType,
  deleteLensType,
} from '../controllers/lensTypeController.js';

const router = Router();
router.use(protect);

router.get('/', listLensTypes);
router.post('/', requireAdmin, createLensType);
router.put('/:id', requireAdmin, updateLensType);
router.delete('/:id', requireAdmin, deleteLensType);

export default router;