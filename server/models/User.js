import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ['admin', 'staff', 'director', 'optician'],
      default: 'staff',
    },

    isActive: { type: Boolean, default: false },
    activationToken: { type: String, select: false },
    activationTokenExpires: { type: Date, select: false },
    activationAttempts: { type: Number, default: 0, select: false },
    activationResendHistory: { type: [Date], default: [], select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
    passwordResetHistory: { type: [Date], default: [], select: false },

    lastLogin: { type: Date },

    loginAttempts: { type: Number, default: 0 },
    lastFailedLoginAt: { type: Date },
    bannedUntil: { type: Date },
    banReason: { type: String, select: false },

    forceLogoutAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);