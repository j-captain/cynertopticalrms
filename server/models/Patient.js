import mongoose from 'mongoose';

const diagnosisSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['prescription', 'diagnostic'], required: true },
    filename: String,
    originalName: String,
    size: Number,
    mimetype: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const billingSchema = new mongoose.Schema(
  {
    lenses: { type: Number, default: 0, min: 0 },
    frame: { type: Number, default: 0, min: 0 },
    fitting: { type: Number, default: 0, min: 0 },
    caseAmount: { type: Number, default: 0, min: 0 },
    fargo: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    billedByName: String,
    billedAt: { type: Date },
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidByName: String,
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    systemNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    lensType: { type: String, required: true, trim: true, maxlength: 80 },
    rxBe: { type: String, trim: true, maxlength: 40, default: '' },
    rxAdd: { type: String, trim: true, maxlength: 40, default: '' },
    rxPd: { type: String, trim: true, maxlength: 40, default: '' },
    diagnoses: {
      type: [diagnosisSchema],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length >= 1 &&
          arr.length <= 5 &&
          arr[0] &&
          (arr[0].code?.trim().length > 0 || arr[0].description?.trim().length > 0),
        message: 'Diagnosis 1 is required (code or description) - max 5',
      },
      default: undefined,
    },
    scheme: {
      type: String,
      enum: ['Self-Sponsored (Cash)', 'Insurance'],
      required: true,
      trim: true,
    },
    insurance: { type: String, trim: true, default: '' },

    lensAmount: { type: Number, required: true, min: 0 },
    frameCode: { type: String, trim: true, maxlength: 80, default: '' },
    frameAmount: { type: Number, required: true, min: 0, default: 0 },
    preAuthDate: { type: Date },
    submissionDate: { type: Date },

    orderPlaced: { type: Boolean, default: false },
    orderDelivered: { type: Boolean, default: false },
    orderHandedToClient: { type: Boolean, default: false },
    orderedAt: { type: Date },
    deliveredAt: { type: Date },
    handedAt: { type: Date },
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    resendCount: { type: Number, default: 0, min: 0 },

    // ─── Billing / dispatch lifecycle ───
    // pending_billing: submitted by staff/admin, not yet billed by optician
    // billed:          optician submitted the bill (unpaid)
    // paid:            director marked paid
    // delivered:       optician marked delivered
    billingStatus: {
      type: String,
      enum: ['pending_billing', 'billed', 'paid', 'delivered'],
      default: 'pending_billing',
    },
    billing: { type: billingSchema, default: undefined },

    // Who marked it delivered (optician) and when
    deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveredByName: String,

    complaint: { type: String, required: true, maxlength: 500, trim: true },

    documents: { type: [documentSchema], default: [] },
  },
  { timestamps: true }
);

patientSchema.virtual('totalAmount').get(function () {
  return (this.lensAmount || 0) + (this.frameAmount || 0);
});

patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

patientSchema.index({ name: 'text', systemNumber: 'text', frameCode: 'text' });
patientSchema.index({ billingStatus: 1 });

export default mongoose.model('Patient', patientSchema);