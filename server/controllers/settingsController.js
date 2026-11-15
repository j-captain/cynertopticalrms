import Settings from '../models/Settings.js';
import { writeAudit } from '../middleware/audit.js';

export const getSettings = async (req, res, next) => {
  try {
    const s = await Settings.getSingleton();
    // expose env fallback flag (never expose secrets)
    res.json({
      ...s.toObject(),
      envFallbackConfigured: Boolean(process.env.ORDER_RECIPIENT_EMAIL),
    });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const allowed = [
      'orderRecipientEmail',
      'smtpFromName',
      'smtpFromEmail',
      'clinicName',
      'currency',
      'allowCustomRecipient',
      'notifyOnFailures',
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (updates.orderRecipientEmail && !/^\S+@\S+\.\S+$/.test(updates.orderRecipientEmail)) {
      return res.status(400).json({ message: 'Invalid order recipient email' });
    }
    const s = await Settings.findOneAndUpdate({ key: 'global' }, updates, {
      new: true,
      upsert: true,
      runValidators: true,
    });
    await writeAudit(req, {
      action: 'settings.update',
      resource: 'Settings',
      resourceId: s._id.toString(),
      meta: { fields: Object.keys(updates) },
    });
    res.json(s);
  } catch (err) {
    next(err);
  }
};