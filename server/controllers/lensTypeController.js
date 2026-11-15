import LensType from '../models/LensType.js';
import { writeAudit } from '../middleware/audit.js';

export const listLensTypes = async (req, res, next) => {
  try {
    const { q, active } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    const list = await LensType.find(filter).sort({ name: 1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const createLensType = async (req, res, next) => {
  try {
    const { name, price, active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    const exists = await LensType.findOne({ name: name.trim() });
    if (exists) return res.status(409).json({ message: 'Lens type already exists' });

    const doc = await LensType.create({
      name: name.trim(),
      price,
      active: active !== false,
      createdBy: req.user?._id,
    });
    await writeAudit(req, {
      action: 'lenstype.create',
      resource: 'LensType',
      resourceId: doc._id.toString(),
      meta: { name: doc.name, price: doc.price },
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

export const updateLensType = async (req, res, next) => {
  try {
    const { name, price, active } = req.body;
    const doc = await LensType.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (name !== undefined && name.trim() && name.trim() !== doc.name) {
      const dup = await LensType.findOne({ name: name.trim() });
      if (dup) return res.status(409).json({ message: 'Another lens type uses that name' });
      doc.name = name.trim();
    }
    if (price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ message: 'Invalid price' });
      }
      doc.price = price;
    }
    if (active !== undefined) doc.active = !!active;
    await doc.save();

    await writeAudit(req, {
      action: 'lenstype.update',
      resource: 'LensType',
      resourceId: doc._id.toString(),
    });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const deleteLensType = async (req, res, next) => {
  try {
    const doc = await LensType.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, {
      action: 'lenstype.delete',
      resource: 'LensType',
      resourceId: doc._id.toString(),
      meta: { name: doc.name },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};