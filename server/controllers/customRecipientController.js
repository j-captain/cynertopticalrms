import CustomRecipient from '../models/CustomRecipient.js';
import { writeAudit } from '../middleware/audit.js';

export const listRecipients = async (req, res, next) => {
  try {
    const { q, active } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { label: { $regex: q, $options: 'i' } },
      ];
    }
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    const list = await CustomRecipient.find(filter).sort({ name: 1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const createRecipient = async (req, res, next) => {
  try {
    const { name, email, label } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    const exists = await CustomRecipient.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const doc = await CustomRecipient.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      label: (label || '').trim(),
      createdBy: req.user?._id,
    });
    await writeAudit(req, {
      action: 'recipient.create',
      resource: 'CustomRecipient',
      resourceId: doc._id.toString(),
      meta: { email: doc.email },
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

export const updateRecipient = async (req, res, next) => {
  try {
    const { name, email, label, active } = req.body;
    const doc = await CustomRecipient.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (email !== undefined && email.toLowerCase() !== doc.email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Invalid email' });
      const dup = await CustomRecipient.findOne({ email: email.toLowerCase() });
      if (dup) return res.status(409).json({ message: 'Another recipient uses that email' });
      doc.email = email.toLowerCase().trim();
    }
    if (name !== undefined && name.trim()) doc.name = name.trim();
    if (label !== undefined) doc.label = (label || '').trim();
    if (active !== undefined) doc.active = !!active;
    await doc.save();

    await writeAudit(req, {
      action: 'recipient.update',
      resource: 'CustomRecipient',
      resourceId: doc._id.toString(),
    });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const deleteRecipient = async (req, res, next) => {
  try {
    const doc = await CustomRecipient.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, {
      action: 'recipient.delete',
      resource: 'CustomRecipient',
      resourceId: doc._id.toString(),
      meta: { email: doc.email },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};