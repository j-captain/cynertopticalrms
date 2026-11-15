import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listRecipients,
  createRecipient,
  updateRecipient,
  deleteRecipient,
} from '../controllers/customRecipientController.js';

const router = Router();
router.use(protect);

router.get('/', listRecipients);
router.post('/', requireAdmin, createRecipient);
router.put('/:id', requireAdmin, updateRecipient);
router.delete('/:id', requireAdmin, deleteRecipient);

export default router;