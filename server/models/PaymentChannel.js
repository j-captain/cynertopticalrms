import mongoose from 'mongoose';

const paymentChannelSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['M-Pesa Paybill', 'M-Pesa Till', 'Bank Transfer', 'Cash'],
      default: 'M-Pesa Paybill',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    businessNumber: { type: String, trim: true, maxlength: 40, default: '' },
    accountNumber: { type: String, trim: true, maxlength: 60, default: '' },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: String,
  },
  { timestamps: true }
);

paymentChannelSchema.index({ active: 1 });

export default mongoose.model('PaymentChannel', paymentChannelSchema);