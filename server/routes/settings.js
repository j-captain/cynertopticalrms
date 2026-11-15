import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = Router();
router.use(protect);

router.get('/', getSettings);
router.put('/', requireAdmin, updateSettings);

export default router;