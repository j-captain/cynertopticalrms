import LoginLog from '../models/LoginLog.js';
import User from '../models/User.js';
import { writeAudit } from '../middleware/audit.js';

/* ────────────────────────────────────────────────────────────────── */
/* List                                                               */
/* ────────────────────────────────────────────────────────────────── */
export const listLoginLogs = async (req, res, next) => {
  try {
    const { q, event, from, to, userId } = req.query;
    const filter = {};

    if (event && event !== 'all') filter.event = event;
    if (userId) filter.user = userId;

    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { userName: { $regex: q, $options: 'i' } },
        { ip: { $regex: q, $options: 'i' } },
        { reason: { $regex: q, $options: 'i' } },
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const logs = await LoginLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Per-user summary - total session time, last activity               */
/* ────────────────────────────────────────────────────────────────── */
export const loginLogSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const [total, success, failed, blocked, banned, loggedOut, durationAgg] =
      await Promise.all([
        LoginLog.countDocuments(match),
        LoginLog.countDocuments({ ...match, event: 'login_success' }),
        LoginLog.countDocuments({ ...match, event: 'login_failed' }),
        LoginLog.countDocuments({ ...match, event: 'blocked' }),
        LoginLog.countDocuments({ ...match, event: 'banned' }),
        LoginLog.countDocuments({ ...match, event: 'logout' }),
        LoginLog.aggregate([
          { $match: { ...match, event: 'logout', durationMs: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$durationMs' }, avg: { $avg: '$durationMs' }, count: { $sum: 1 } } },
        ]),
      ]);

    const d = durationAgg[0] || { total: 0, avg: 0, count: 0 };

    res.json({
      count: total,
      success,
      failed,
      blocked,
      banned,
      loggedOut,
      totalSessionMs: d.total,
      avgSessionMs: Math.round(d.avg || 0),
      sessionsCounted: d.count,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Ban a user (admin action)                                          */
/* ────────────────────────────────────────────────────────────────── */
export const banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const minutes = Math.max(1, Math.min(7 * 24 * 60, Number(req.body?.minutes) || 60));

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot ban yourself' });
    }

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    const until = new Date(Date.now() + minutes * 60 * 1000);
    u.bannedUntil = until;
    u.banReason = req.body?.reason || 'admin_action';
    await u.save({ validateBeforeSave: false });

    await LoginLog.create({
      email: u.email,
      user: u._id,
      userName: u.name,
      event: 'banned',
      reason: req.body?.reason || 'admin_action',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      meta: { until: until.toISOString(), minutes, by: req.user._id.toString() },
    });

    await writeAudit(req, {
      action: 'user.ban',
      resource: 'User',
      resourceId: u._id.toString(),
      meta: { minutes, until: until.toISOString() },
    });

    res.json({ message: 'User banned', bannedUntil: until.toISOString() });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Unban a user                                                       */
/* ────────────────────────────────────────────────────────────────── */
export const unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    u.bannedUntil = undefined;
    u.banReason = undefined;
    u.loginAttempts = 0;
    u.lastFailedLoginAt = undefined;
    await u.save({ validateBeforeSave: false });

    await LoginLog.create({
      email: u.email,
      user: u._id,
      userName: u.name,
      event: 'unbanned',
      reason: 'admin_action',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      meta: { by: req.user._id.toString() },
    });

    await writeAudit(req, {
      action: 'user.unban',
      resource: 'User',
      resourceId: u._id.toString(),
    });

    res.json({ message: 'User unbanned' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Force logout (invalidate current token)                            */
/* ────────────────────────────────────────────────────────────────── */
export const forceLogoutUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot force-logout yourself' });
    }
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    u.forceLogoutAt = new Date();
    await u.save({ validateBeforeSave: false });

    await LoginLog.create({
      email: u.email,
      user: u._id,
      userName: u.name,
      event: 'force_logout',
      reason: 'admin_action',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      meta: { by: req.user._id.toString() },
    });

    await writeAudit(req, {
      action: 'user.force_logout',
      resource: 'User',
      resourceId: u._id.toString(),
    });

    res.json({ message: 'Session terminated. User must log in again.' });
  } catch (err) {
    next(err);
  }
};