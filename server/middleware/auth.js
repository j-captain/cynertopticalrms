import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is inactive', code: 'ACCOUNT_INACTIVE' });
    }

    if (user.forceLogoutAt && decoded.iat * 1000 < user.forceLogoutAt.getTime()) {
      return res.status(401).json({
        message: 'Session ended by administrator. Please sign in again.',
        code: 'SESSION_REVOKED',
      });
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      const retryAfter = Math.ceil((user.bannedUntil - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(403).json({
        message: 'Account temporarily locked',
        code: 'ACCOUNT_BANNED',
        retryAfter,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/* ─── Role gate (any role in the list) ─── */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: `Access requires: ${roles.join(' or ')}` });
  }
  next();
};

export const requireOptician = requireRole('optician', 'admin');
export const requireDirector = requireRole('director', 'admin');