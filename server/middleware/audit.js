import AuditLog from '../models/AuditLog.js';

export const writeAudit = async (req, { action, resource, resourceId, meta, status = 'success' }) => {
  try {
    const safeReq = req || {};
    const headers = safeReq.headers || {};
    const user = safeReq.user || {};

    await AuditLog.create({
      actor: user._id,
      actorName: user.name,
      actorEmail: user.email,
      action,
      resource,
      resourceId,
      meta: meta || {},
      ip: safeReq.ip || null,
      userAgent: headers['user-agent'] || null,
      status,
    });
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
};