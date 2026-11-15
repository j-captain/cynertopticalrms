import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { dashboardStats, ordersReport } from '../controllers/reportController.js';
import { listOrderLogs } from '../controllers/orderController.js';

const router = Router();
router.use(protect);

router.get('/dashboard', dashboardStats);
router.get('/orders', ordersReport);
router.get('/order-logs', listOrderLogs);

export default router;