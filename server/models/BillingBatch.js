import mongoose from 'mongoose';

const billingBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, unique: true, index: true },
    orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true }],
    fargoAmount: { type: Number, default: 0, min: 0 },
    // Sum of all order billing.total at submit time - snapshot so
    // later edits don't retroactively change what the director was billed
    ordersTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },   // ordersTotal + fargoAmount

    status: {
      type: String,
      enum: ['submitted', 'paid', 'cancelled'],
      default: 'submitted',
      index: true,
    },

    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedByName: String,
    submittedAt: { type: Date, default: Date.now },

    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidByName: { type: String, default: null },
  },
  { timestamps: true }
);

billingBatchSchema.index({ submittedAt: -1 });
billingBatchSchema.index({ status: 1, submittedAt: -1 });

export default mongoose.model('BillingBatch', billingBatchSchema);