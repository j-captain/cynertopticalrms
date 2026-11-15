import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listLoginLogs,
  loginLogSummary,
  banUser,
  unbanUser,
  forceLogoutUser,
} from '../controllers/loginLogController.js';

const router = Router();
router.use(protect, requireAdmin);

router.get('/', listLoginLogs);
router.get('/summary', loginLogSummary);
router.post('/user/:id/ban', banUser);
router.post('/user/:id/unban', unbanUser);
router.post('/user/:id/force-logout', forceLogoutUser);

export default router;