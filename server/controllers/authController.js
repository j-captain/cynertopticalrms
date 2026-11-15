import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import { validationResult } from 'express-validator';
import { writeAudit } from '../middleware/audit.js';
import {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendAccountActivatedEmail,
} from '../utils/mailer.js';

/* ────────────────────────────────────────────────────────────────── */
/* Constants                                                          */
/* ────────────────────────────────────────────────────────────────── */
const ACTIVATION_TTL_MS = 5 * 60 * 1000;
const ACTIVATION_RESEND_WINDOW_MS = 30 * 60 * 1000;
const ACTIVATION_RESEND_MAX = 2;
const ACTIVATION_MAX_ATTEMPTS = 3;

const RESET_TTL_MS = 5 * 60 * 1000;
const RESET_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MAX = 2;
const RESET_MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 3;

const CODE_LENGTH = 8;

const BAN_LADDER = {
  3: 5 * 60 * 1000,
  4: 15 * 60 * 1000,
  5: 60 * 60 * 1000,
};
const BAN_LADDER_MAX_INDEX = 5;
const FAIL_WINDOW_MS = 30 * 60 * 1000;

/* ────────────────────────────────────────────────────────────────── */
/* Helpers                                                            */
/* ────────────────────────────────────────────────────────────────── */
const signToken = (id) =>
  jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const genericOk = (
  res,
  message = 'If an eligible account exists, an email has been sent.'
) => res.json({ message });

const trimHistory = (arr, windowMs) => {
  const cutoff = Date.now() - windowMs;
  return (arr || []).filter((d) => new Date(d).getTime() >= cutoff);
};

const clientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket?.remoteAddress ||
  '';

const clientUa = (req) => req.headers['user-agent'] || '';

const logLoginEvent = async ({ event, email, user, reason, req, meta, durationMs }) => {
  try {
    await LoginLog.create({
      email,
      user: user?._id,
      userName: user?.name,
      event,
      reason,
      ip: clientIp(req),
      userAgent: clientUa(req),
      durationMs,
      meta,
    });
  } catch (e) {
    console.error('LoginLog write failed:', e.message);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Code generator                                                     */
/* ────────────────────────────────────────────────────────────────── */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

const generateShortCode = () => {
  const pick = (set) => set[crypto.randomInt(0, set.length)];
  const chars = [
    pick(LETTERS), pick(LETTERS), pick(LETTERS), pick(LETTERS),
    pick(DIGITS),  pick(DIGITS),  pick(DIGITS),  pick(DIGITS),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/* ────────────────────────────────────────────────────────────────── */
/* Login                                                              */
/* ────────────────────────────────────────────────────────────────── */
export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: errors.array()[0].msg });

    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      await logLoginEvent({
        event: 'login_failed',
        email: normalizedEmail,
        reason: 'invalid_credentials',
        req,
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      const retryAfter = Math.ceil((user.bannedUntil - Date.now()) / 1000);
      await logLoginEvent({
        event: 'blocked',
        email: user.email,
        user,
        reason: 'banned',
        req,
        meta: { until: user.bannedUntil.toISOString(), retryAfter },
      });
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(403).json({
        message: `Account temporarily locked. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        code: 'ACCOUNT_BANNED',
        retryAfter,
      });
    }

    const passwordOk = await user.comparePassword(password);

    if (!passwordOk) {
      const now = Date.now();
      if (
        user.lastFailedLoginAt &&
        now - new Date(user.lastFailedLoginAt).getTime() > FAIL_WINDOW_MS
      ) {
        user.loginAttempts = 0;
      }
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date(now);

      let bannedNow = false;
      const ladderMs =
        BAN_LADDER[user.loginAttempts] ||
        (user.loginAttempts > BAN_LADDER_MAX_INDEX ? BAN_LADDER[5] : 0);

      if (ladderMs > 0) {
        user.bannedUntil = new Date(now + ladderMs);
        user.banReason = 'too_many_failed_logins';
        bannedNow = true;
      }

      await user.save({ validateBeforeSave: false });

      await logLoginEvent({
        event: bannedNow ? 'banned' : 'login_failed',
        email: user.email,
        user,
        reason: 'invalid_credentials',
        req,
        meta: {
          attempt: user.loginAttempts,
          bannedUntil: user.bannedUntil?.toISOString(),
          banDurationMs: ladderMs || undefined,
        },
      });

      if (bannedNow) {
        const retryAfter = Math.ceil(ladderMs / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(403).json({
          message: `Too many failed attempts. Account locked for ${Math.ceil(ladderMs / 60000)} minute(s).`,
          code: 'ACCOUNT_BANNED',
          retryAfter,
        });
      }

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      await logLoginEvent({
        event: 'login_failed',
        email: user.email,
        user,
        reason: 'inactive',
        req,
      });
      return res.status(403).json({
        message: 'Account is inactive. Please wait for activation instructions.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    user.loginAttempts = 0;
    user.lastFailedLoginAt = undefined;
    user.bannedUntil = undefined;
    user.banReason = undefined;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.cookie('token', token, cookieOptions());

    await logLoginEvent({
      event: 'login_success',
      email: user.email,
      user,
      req,
    });

    await writeAudit(
      { user },
      {
        action: 'auth.login',
        resource: 'User',
        resourceId: user._id.toString(),
        status: 'success',
      }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive !== false,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Logout                                                             */
/* ────────────────────────────────────────────────────────────────── */
export const logout = async (req, res, next) => {
  try {
    const u = req.user;

    let durationMs;
    if (u) {
      const lastLogin = await LoginLog.findOne({
        user: u._id,
        event: 'login_success',
      })
        .sort({ createdAt: -1 })
        .lean();
      if (lastLogin) {
        durationMs = Date.now() - new Date(lastLogin.createdAt).getTime();
      }
    }

    res.clearCookie('token');

    if (u) {
      await logLoginEvent({
        event: 'logout',
        email: u.email,
        user: u,
        req,
        durationMs,
      });
    }

    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Me                                                                 */
/* ────────────────────────────────────────────────────────────────── */
export const me = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive !== false,
    },
  });
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    await writeAudit(req, {
      action: 'auth.change_password',
      resource: 'User',
      resourceId: user._id.toString(),
    });
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (email && email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(409).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (name) user.name = name;
    await user.save();
    await writeAudit(req, {
      action: 'auth.update_profile',
      resource: 'User',
      resourceId: user._id.toString(),
    });
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Activation (via code) - sends "account activated" email on success */
/* ────────────────────────────────────────────────────────────────── */
export const activateWithCode = async (req, res, next) => {
  try {
    const codeRaw = String(req.body?.code || '').trim().toUpperCase();
    if (!codeRaw || codeRaw.length !== CODE_LENGTH) {
      return res.status(400).json({
        message: `Enter the ${CODE_LENGTH}-character activation code`,
        code: 'ACTIVATION_CODE_INVALID',
      });
    }
    const user = await User.findOne({
      activationToken: codeRaw,
      activationTokenExpires: { $gt: new Date() },
    }).select('+activationToken +activationTokenExpires +activationAttempts');
    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired activation code. Request a new one.',
        code: 'ACTIVATION_CODE_INVALID',
      });
    }
    if (user.activationAttempts >= ACTIVATION_MAX_ATTEMPTS) {
      user.activationToken = undefined;
      user.activationTokenExpires = undefined;
      user.activationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        message: 'Too many incorrect attempts. Request a new code.',
        code: 'ACTIVATION_CODE_INVALID',
      });
    }
    if (user.isActive) {
      user.activationToken = undefined;
      user.activationTokenExpires = undefined;
      user.activationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        message: 'This account is already active. You can sign in.',
        code: 'ACCOUNT_ALREADY_ACTIVE',
      });
    }

    user.isActive = true;
    user.activationToken = undefined;
    user.activationTokenExpires = undefined;
    user.activationAttempts = 0;
    await user.save({ validateBeforeSave: false });

    // Confirmation email - account is now active
    try {
      await sendAccountActivatedEmail({
        to: user.email,
        name: user.name,
        email: user.email,
      });
    } catch (e) {
      console.error('Account activated email failed:', e.message);
    }

    await writeAudit(req, {
      action: 'auth.activate_via_code',
      resource: 'User',
      resourceId: user._id.toString(),
    });

    res.json({ message: 'Account activated. You can sign in now.' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Activation - resend code                                           */
/* ────────────────────────────────────────────────────────────────── */
export const resendActivation = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address', code: 'INVALID_EMAIL' });
    }
    const user = await User.findOne({ email }).select(
      '+activationResendHistory +activationToken +activationTokenExpires +activationAttempts'
    );
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address.', code: 'ACCOUNT_NOT_FOUND' });
    }
    if (user.isActive === true) {
      return res.status(400).json({ message: 'This account is already active. You can sign in.', code: 'ACCOUNT_ALREADY_ACTIVE' });
    }
    const history = trimHistory(user.activationResendHistory, ACTIVATION_RESEND_WINDOW_MS);
    if (history.length >= ACTIVATION_RESEND_MAX) {
      const oldest = new Date(history[0]).getTime();
      const retryAfter = Math.max(0, Math.ceil((oldest + ACTIVATION_RESEND_WINDOW_MS - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: 'Too many activation resends. Please try again later.',
        retryAfter,
        code: 'ACTIVATION_RESEND_LIMIT',
      });
    }
    const code = generateShortCode();
    const expires = new Date(Date.now() + ACTIVATION_TTL_MS);
    user.activationToken = code;
    user.activationTokenExpires = expires;
    user.activationAttempts = 0;
    user.activationResendHistory = [...history, new Date()];
    await user.save({ validateBeforeSave: false });
    try {
      await sendActivationEmail({
        to: user.email,
        name: user.name,
        code,
        ttlMinutes: 5,
        isNewAccount: false,
      });
    } catch (e) {
      console.error('Activation resend email failed:', e.message);
    }
    await writeAudit(req, {
      action: 'auth.activation_resend',
      resource: 'User',
      resourceId: user._id.toString(),
      meta: { resendsInWindow: history.length + 1 },
    });
    const oldest = history.length
      ? Math.min(...history.map((d) => new Date(d).getTime()))
      : Date.now();
    const nextAllowedAt = new Date(oldest + ACTIVATION_RESEND_WINDOW_MS).toISOString();
    return res.json({
      message: 'Activation code sent.',
      remaining: ACTIVATION_RESEND_MAX - (history.length + 1),
      nextAllowedAt,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Password reset                                                     */
/* ────────────────────────────────────────────────────────────────── */
export const requestPasswordReset = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return genericOk(res);
    const user = await User.findOne({ email }).select(
      '+passwordResetHistory +passwordResetToken +passwordResetTokenExpires +passwordResetAttempts'
    );
    if (!user) return genericOk(res);
    if (user.isActive !== true) {
      return res.status(403).json({
        message: 'Account must be activated before a password reset can be requested.',
        code: 'ACCOUNT_INACTIVE',
      });
    }
    const ageMs = Date.now() - new Date(user.createdAt).getTime();
    if (ageMs < RESET_MIN_ACCOUNT_AGE_MS) {
      const retryAfter = Math.ceil((RESET_MIN_ACCOUNT_AGE_MS - ageMs) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: 'Password reset is not available within 24 hours of account creation.',
        retryAfter,
        code: 'RESET_TOO_EARLY',
      });
    }
    const history = trimHistory(user.passwordResetHistory, RESET_WINDOW_MS);
    if (history.length >= RESET_MAX) {
      const oldest = new Date(history[0]).getTime();
      const retryAfter = Math.max(0, Math.ceil((oldest + RESET_WINDOW_MS - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: 'Too many password resets. Please try again later.',
        retryAfter,
        code: 'RESET_LIMIT',
      });
    }
    const code = generateShortCode();
    const expires = new Date(Date.now() + RESET_TTL_MS);
    user.passwordResetToken = code;
    user.passwordResetTokenExpires = expires;
    user.passwordResetAttempts = 0;
    await user.save({ validateBeforeSave: false });
    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, code, ttlMinutes: 5 });
    } catch (e) {
      console.error('Password reset email failed:', e.message);
    }
    await writeAudit(req, {
      action: 'auth.password_reset_requested',
      resource: 'User',
      resourceId: user._id.toString(),
    });
    return res.json({
      message: 'If an eligible account exists, an email has been sent.',
      remaining: RESET_MAX - history.length,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyResetCode = async (req, res, next) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code || code.length !== CODE_LENGTH) {
      return res.status(400).json({ message: `Enter the ${CODE_LENGTH}-character reset code`, code: 'RESET_CODE_INVALID' });
    }
    const user = await User.findOne({
      passwordResetToken: code,
      passwordResetTokenExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetTokenExpires +passwordResetAttempts');
    if (!user) {
      return res.status(400).json({ message: 'This reset code is invalid or has expired. Request a new one.', code: 'RESET_CODE_INVALID' });
    }
    if (user.passwordResetAttempts >= RESET_MAX_ATTEMPTS) {
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      user.passwordResetAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'Too many incorrect attempts. Request a new code.', code: 'RESET_CODE_INVALID' });
    }
    if (user.isActive !== true) {
      return res.status(403).json({ message: 'Account must be activated before a password can be reset.', code: 'ACCOUNT_INACTIVE' });
    }
    return res.json({ message: 'Code verified.', token: code });
  } catch (err) {
    next(err);
  }
};

export const consumePasswordReset = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    const code = String(token || '').trim().toUpperCase();
    if (!code || code.length !== CODE_LENGTH) {
      return res.status(400).json({ message: 'Invalid or missing reset code' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const user = await User.findOne({
      passwordResetToken: code,
      passwordResetTokenExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetTokenExpires +passwordResetHistory +passwordResetAttempts');
    if (!user) return res.status(400).json({ message: 'Reset code is invalid or has expired' });
    if (user.isActive !== true) {
      return res.status(403).json({ message: 'Account must be activated before a password can be reset.', code: 'ACCOUNT_INACTIVE' });
    }
    if (user.passwordResetAttempts >= RESET_MAX_ATTEMPTS) {
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      user.passwordResetAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'Too many incorrect attempts. Request a new code.', code: 'RESET_CODE_INVALID' });
    }
    const history = trimHistory(user.passwordResetHistory, RESET_WINDOW_MS);
    user.passwordResetHistory = [...history, new Date()];
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;
    user.passwordResetAttempts = 0;
    await user.save();
    await writeAudit(req, {
      action: 'auth.password_reset_consumed',
      resource: 'User',
      resourceId: user._id.toString(),
    });
    return res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

export const generateActivationToken = () => {
  const code = generateShortCode();
  const expires = new Date(Date.now() + ACTIVATION_TTL_MS);
  return { raw: code, expires };
};