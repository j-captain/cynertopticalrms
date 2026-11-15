import PaymentChannel from '../models/PaymentChannel.js';
import { writeAudit } from '../middleware/audit.js';

/* ─── Read: director + admin ─── */
const requireView = (req, res) => {
  if (!['director', 'admin'].includes(req.user?.role)) {
    res.status(403).json({ message: 'Director or admin only' });
    return false;
  }
  return true;
};

/* ─── Mutations: admin only ─── */
const requireAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin only - directors have read-only access' });
    return false;
  }
  return true;
};

const publicChannel = (c) => ({
  _id: c._id,
  provider: c.provider,
  name: c.name,
  businessNumber: c.businessNumber || '',
  accountNumber: c.accountNumber || '',
  active: c.active !== false,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  createdByName: c.createdByName || '',
  updatedByName: c.updatedByName || '',
});

/* ─── List (director + admin) ─── */
export const listChannels = async (req, res, next) => {
  try {
    if (!requireView(req, res)) return;
    const rows = await PaymentChannel.find().sort({ active: -1, createdAt: -1 }).lean();
    res.json(rows.map(publicChannel));
  } catch (err) {
    next(err);
  }
};

/* ─── Create (admin only) ─── */
export const createChannel = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { provider, name, businessNumber, accountNumber, active } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const c = await PaymentChannel.create({
      provider: provider || 'M-Pesa Paybill',
      name: String(name).trim(),
      businessNumber: String(businessNumber || '').trim(),
      accountNumber: String(accountNumber || '').trim(),
      active: active !== false,
      createdBy: req.user._id,
      createdByName: req.user.name,
      updatedBy: req.user._id,
      updatedByName: req.user.name,
    });
    await writeAudit(req, {
      action: 'paymentChannel.create',
      resource: 'PaymentChannel',
      resourceId: c._id.toString(),
      meta: { name: c.name, provider: c.provider },
    });
    res.status(201).json(publicChannel(c));
  } catch (err) {
    next(err);
  }
};

/* ─── Update (admin only) ─── */
export const updateChannel = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const c = await PaymentChannel.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Channel not found' });

    const { provider, name, businessNumber, accountNumber, active } = req.body || {};
    if (provider !== undefined) c.provider = provider;
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      c.name = String(name).trim();
    }
    if (businessNumber !== undefined) c.businessNumber = String(businessNumber).trim();
    if (accountNumber !== undefined) c.accountNumber = String(accountNumber).trim();
    if (active !== undefined) c.active = !!active;
    c.updatedBy = req.user._id;
    c.updatedByName = req.user.name;

    await c.save();
    await writeAudit(req, {
      action: 'paymentChannel.update',
      resource: 'PaymentChannel',
      resourceId: c._id.toString(),
      meta: { name: c.name },
    });
    res.json(publicChannel(c));
  } catch (err) {
    next(err);
  }
};

/* ─── Delete (admin only) ─── */
export const deleteChannel = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const c = await PaymentChannel.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: 'Channel not found' });
    await writeAudit(req, {
      action: 'paymentChannel.delete',
      resource: 'PaymentChannel',
      resourceId: c._id.toString(),
      meta: { name: c.name },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

/* ─── Toggle active (admin only) ─── */
export const toggleChannel = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const c = await PaymentChannel.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Channel not found' });
    c.active = !c.active;
    c.updatedBy = req.user._id;
    c.updatedByName = req.user.name;
    await c.save();
    await writeAudit(req, {
      action: 'paymentChannel.toggle',
      resource: 'PaymentChannel',
      resourceId: c._id.toString(),
      meta: { active: c.active },
    });
    res.json(publicChannel(c));
  } catch (err) {
    next(err);
  }
};