import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listOrders,
  resendOrder,
  cancelOrder,
  orderStats,
} from '../controllers/orderActionsController.js';

const router = Router();
router.use(protect);

router.get('/', listOrders);
router.get('/stats', orderStats);
router.post('/:logId/resend', resendOrder);
router.post('/patient/:id/cancel', requireAdmin, cancelOrder);

export default router;