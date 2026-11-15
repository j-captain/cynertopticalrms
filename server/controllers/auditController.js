import AuditLog from '../models/AuditLog.js';

export const listAudit = async (req, res, next) => {
  try {
    const { q, action, from, to } = req.query;
    const filter = {};
    if (action) filter.action = { $regex: `^${action}` };
    if (q) {
      filter.$or = [
        { actorName: { $regex: q, $options: 'i' } },
        { actorEmail: { $regex: q, $options: 'i' } },
        { action: { $regex: q, $options: 'i' } },
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
};

export const auditSummary = async (req, res, next) => {
  try {
    const { q, action, from, to } = req.query;
    const filter = {};
    if (action) filter.action = { $regex: `^${action}` };
    if (q) {
      filter.$or = [
        { actorName: { $regex: q, $options: 'i' } },
        { actorEmail: { $regex: q, $options: 'i' } },
        { action: { $regex: q, $options: 'i' } },
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [total, success, failed, sent] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.countDocuments({ ...filter, status: 'success' }),
      AuditLog.countDocuments({ ...filter, status: 'failed' }),
      AuditLog.countDocuments({ ...filter, status: 'sent' }),
    ]);

    // Breakdown by action prefix
    const byAction = await AuditLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $arrayElemAt: [{ $split: ['$action', '.'] }, 0] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Distinct actors involved
    const actorCount = await AuditLog.distinct('actor', filter);

    res.json({
      count: total,
      success,
      failed,
      sent,
      actors: actorCount.filter(Boolean).length,
      breakdown: byAction.map((a) => ({ key: a._id || '(unknown)', count: a.count })),
    });
  } catch (err) {
    next(err);
  }
};