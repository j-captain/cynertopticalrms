import mongoose from 'mongoose';

const loginLogSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: String,
    event: {
      type: String,
      enum: ['login_success', 'login_failed', 'logout', 'blocked', 'banned', 'unbanned', 'force_logout'],
      required: true,
    },
    reason: String,
    ip: String,
    userAgent: String,
    // Session duration for logout events (ms between matching login and logout)
    durationMs: Number,
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

loginLogSchema.index({ createdAt: -1 });
loginLogSchema.index({ event: 1 });

export default mongoose.model('LoginLog', loginLogSchema);