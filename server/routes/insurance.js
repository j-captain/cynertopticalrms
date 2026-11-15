import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listInsurances,
  createInsurance,
  updateInsurance,
  deleteInsurance,
} from '../controllers/insuranceController.js';

const router = Router();
router.use(protect);

router.get('/', listInsurances);
router.post('/', requireAdmin, createInsurance);
router.put('/:id', requireAdmin, updateInsurance);
router.delete('/:id', requireAdmin, deleteInsurance);

export default router;