import Insurance from '../models/Insurance.js';
import { writeAudit } from '../middleware/audit.js';

export const listInsurances = async (req, res, next) => {
  try {
    const { q, active } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    const list = await Insurance.find(filter).sort({ name: 1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const createInsurance = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const trimmed = name.trim();
    const exists = await Insurance.findOne({ name: trimmed });
    if (exists) return res.status(409).json({ message: 'Insurance already exists' });

    const doc = await Insurance.create({ name: trimmed, createdBy: req.user?._id });
    await writeAudit(req, {
      action: 'insurance.create',
      resource: 'Insurance',
      resourceId: doc._id.toString(),
      meta: { name: doc.name },
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

export const updateInsurance = async (req, res, next) => {
  try {
    const { name, active } = req.body;
    const doc = await Insurance.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (name !== undefined && name.trim() && name.trim() !== doc.name) {
      const exists = await Insurance.findOne({ name: name.trim() });
      if (exists) return res.status(409).json({ message: 'Another insurance uses that name' });
      doc.name = name.trim();
    }
    if (active !== undefined) doc.active = !!active;
    await doc.save();

    await writeAudit(req, {
      action: 'insurance.update',
      resource: 'Insurance',
      resourceId: doc._id.toString(),
    });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const deleteInsurance = async (req, res, next) => {
  try {
    const doc = await Insurance.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, {
      action: 'insurance.delete',
      resource: 'Insurance',
      resourceId: doc._id.toString(),
      meta: { name: doc.name },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};