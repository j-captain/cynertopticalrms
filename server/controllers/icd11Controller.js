import ICD11Code from '../models/ICD11Code.js';
import { writeAudit } from '../middleware/audit.js';

export const listCodes = async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { code: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }
    const codes = await ICD11Code.find(filter).sort({ code: 1 }).limit(1000).lean();
    res.json(codes);
  } catch (err) {
    next(err);
  }
};

export const lookupCode = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ message: 'code is required' });
    const c = await ICD11Code.findOne({ code: code.trim().toUpperCase() }).lean();
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (err) {
    next(err);
  }
};

export const createCode = async (req, res, next) => {
  try {
    const { code, description } = req.body;
    if (!code || !description) {
      return res.status(400).json({ message: 'code and description are required' });
    }
    const exists = await ICD11Code.findOne({ code: code.trim().toUpperCase() });
    if (exists) return res.status(409).json({ message: 'Code already exists' });
    const c = await ICD11Code.create({
      code: code.trim().toUpperCase(),
      description: description.trim(),
      createdBy: req.user?._id,
    });
    await writeAudit(req, { action: 'icd11.create', resource: 'ICD11Code', resourceId: c._id.toString(), meta: { code: c.code } });
    res.status(201).json(c);
  } catch (err) {
    next(err);
  }
};

export const updateCode = async (req, res, next) => {
  try {
    const { description } = req.body;
    const c = await ICD11Code.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (description !== undefined) c.description = description.trim();
    await c.save();
    await writeAudit(req, { action: 'icd11.update', resource: 'ICD11Code', resourceId: c._id.toString() });
    res.json(c);
  } catch (err) {
    next(err);
  }
};

export const deleteCode = async (req, res, next) => {
  try {
    const c = await ICD11Code.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, { action: 'icd11.delete', resource: 'ICD11Code', resourceId: c._id.toString(), meta: { code: c.code } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};