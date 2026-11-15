import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  logout,
  me,
  changePassword,
  updateProfile,
  activateWithCode,
  resendActivation,
  requestPasswordReset,
  verifyResetCode,
  consumePasswordReset,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password required'),
  login
);
router.post('/logout', logout);
router.get('/me', protect, me);
router.put('/change-password', protect, changePassword);
router.put('/profile', protect, updateProfile);

/* ─── Activation ─── */
router.post(
  '/activate',
  body('code').isString().notEmpty().withMessage('Activation code required'),
  activateWithCode
);
router.post(
  '/activate/resend',
  body('email').isEmail().withMessage('Valid email required'),
  resendActivation
);

/* ─── Password reset ─── */
router.post(
  '/password/request-reset',
  body('email').isEmail().withMessage('Valid email required'),
  requestPasswordReset
);
router.post(
  '/password/verify-code',
  body('code').isString().notEmpty().withMessage('Reset code required'),
  verifyResetCode
);
router.post(
  '/password/reset',
  body('token').isString().notEmpty(),
  body('password').isLength({ min: 8 }),
  consumePasswordReset
);

export default router;