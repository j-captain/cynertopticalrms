import crypto from 'node:crypto';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { writeAudit } from '../middleware/audit.js';
import {
  sendActivationEmail,
  sendAccountActivatedEmail,
} from '../utils/mailer.js';

const requireAdminHere = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin only' });
    return false;
  }
  return true;
};

/* ────────────────────────────────────────────────────────────────── */
/* Roles                                                              */
/* ────────────────────────────────────────────────────────────────── */
const VALID_ROLES = ['admin', 'staff', 'director', 'optician'];

const normalizeRole = (role) =>
  VALID_ROLES.includes(role) ? role : 'staff';

const publicUser = (u) => ({
  _id: u._id,
  id: u._id,
  name: u.name,
  email: u.email,
  role: normalizeRole(u.role),
  isActive: u.isActive !== false,
  lastLogin: u.lastLogin,
  createdAt: u.createdAt,
});

/* ────────────────────────────────────────────────────────────────── */
/* Short-code generator                                               */
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
/* List                                                               */
/* ────────────────────────────────────────────────────────────────── */
export const listUsers = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;
    const users = await User.find()
      .select('-password -activationToken -activationTokenExpires -activationAttempts -activationResendHistory -passwordResetToken -passwordResetTokenExpires -passwordResetAttempts -passwordResetHistory')
      .sort({ createdAt: -1 })
      .lean();
    res.json(users.map(publicUser));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Create - accepts all 4 roles                                       */
/* ────────────────────────────────────────────────────────────────── */
export const createUser = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const safeRole = normalizeRole(role);

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const u = await User.create({
      name,
      email,
      password,
      role: safeRole,
      isActive: false,
    });

    await writeAudit(req, {
      action: 'user.create',
      resource: 'User',
      resourceId: u._id.toString(),
      meta: { email: u.email, role: u.role, isActive: false },
    });
    res.status(201).json(publicUser(u));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Update - accepts all 4 roles                                       */
/* ────────────────────────────────────────────────────────────────── */
export const updateUser = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const { id } = req.params;
    const { name, role } = req.body;

    const isSelf = String(id) === String(req.user._id);
    if (isSelf && role !== undefined) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) u.name = name;
    if (role !== undefined) u.role = normalizeRole(role);
    await u.save();

    await writeAudit(req, {
      action: 'user.update',
      resource: 'User',
      resourceId: u._id.toString(),
      meta: { name, role: u.role },
    });
    res.json(publicUser(u));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Reset password                                                     */
/* ────────────────────────────────────────────────────────────────── */
export const resetPassword = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const u = await User.findById(req.params.id).select('+password');
    if (!u) return res.status(404).json({ message: 'User not found' });
    u.password = password;
    await u.save();
    await writeAudit(req, {
      action: 'user.reset_password',
      resource: 'User',
      resourceId: u._id.toString(),
    });
    res.json({ message: 'Password reset' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Delete                                                             */
/* ────────────────────────────────────────────────────────────────── */
export const deleteUser = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }
    const u = await User.findByIdAndDelete(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    await writeAudit(req, {
      action: 'user.delete',
      resource: 'User',
      resourceId: u._id.toString(),
      meta: { email: u.email },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Activate by admin                                                  */
/* ────────────────────────────────────────────────────────────────── */
export const activateByAdmin = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (u.isActive) {
      return res.status(400).json({ message: 'Account is already active' });
    }

    u.isActive = true;
    u.activationToken = undefined;
    u.activationTokenExpires = undefined;
    u.activationAttempts = 0;
    await u.save({ validateBeforeSave: false });

    try {
      await sendAccountActivatedEmail({
        to: u.email,
        name: u.name,
        email: u.email,
      });
    } catch (e) {
      console.error('Account activated email failed:', e.message);
    }

    await writeAudit(req, {
      action: 'user.activate_by_admin',
      resource: 'User',
      resourceId: u._id.toString(),
      meta: { email: u.email, activatedBy: req.user._id.toString() },
    });

    res.json({ message: 'Account activated', user: publicUser(u) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Send activation email                                              */
/* ────────────────────────────────────────────────────────────────── */
export const sendActivation = async (req, res, next) => {
  try {
    if (!requireAdminHere(req, res)) return;

    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (u.isActive) {
      return res.status(400).json({ message: 'Account is already active' });
    }

    const code = generateShortCode();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    u.activationToken = code;
    u.activationTokenExpires = expires;
    u.activationAttempts = 0;
    await u.save({ validateBeforeSave: false });

    let emailStatus = 'sent';
    let emailError;
    try {
      await sendActivationEmail({
        to: u.email,
        name: u.name,
        code,
        ttlMinutes: 5,
        isNewAccount: true,
      });
    } catch (e) {
      emailStatus = 'failed';
      emailError = e.message;
    }

    await writeAudit(req, {
      action: 'user.send_activation',
      resource: 'User',
      resourceId: u._id.toString(),
      status: emailStatus,
      meta: { email: u.email, expiresAt: expires.toISOString() },
    });

    if (emailStatus === 'failed') {
      return res.status(502).json({
        message: 'Activation email could not be sent',
        detail: emailError,
      });
    }

    res.json({
      message: 'Activation email sent',
      user: publicUser(u),
      expiresAt: expires.toISOString(),
    });
  } catch (err) {
    next(err);
  }
};