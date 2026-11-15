import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorEmail: String,
    action: { type: String, required: true },
    resource: String,
    resourceId: String,
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['success', 'failed', 'sent'],
      default: 'success',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ actor: 1 });

export default mongoose.model('AuditLog', auditLogSchema);