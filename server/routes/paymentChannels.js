import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  toggleChannel,
} from '../controllers/paymentChannelController.js';

const router = Router();
router.use(protect);

router.get('/', listChannels);
router.post('/', createChannel);
router.put('/:id', updateChannel);
router.post('/:id/toggle', toggleChannel);
router.delete('/:id', deleteChannel);

export default router;