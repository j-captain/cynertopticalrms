import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
  activateByAdmin,
  sendActivation,
} from '../controllers/usersController.js';

const router = Router();
router.use(protect, requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

router.post('/:id/activate', activateByAdmin);
router.post('/:id/activate/email', sendActivation);

export default router;