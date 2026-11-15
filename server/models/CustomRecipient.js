import mongoose from 'mongoose';

const customRecipientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customRecipientSchema.index({ email: 1 }, { unique: true });
customRecipientSchema.index({ name: 'text', email: 'text', label: 'text' });

export default mongoose.model('CustomRecipient', customRecipientSchema);