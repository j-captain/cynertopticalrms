import mongoose from 'mongoose';

const diagnosisSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const orderLogSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: String,
    systemNumber: String,
    lensType: String,
    rxBe: String,
    rxAdd: String,
    rxPd: String,
    diagnoses: [diagnosisSchema],
    complaint: String,
    scheme: String,
    insurance: String,
    lensAmount: Number,
    frameCode: String,
    frameAmount: Number,
    totalAmount: Number,
    recipientEmail: { type: String, required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentByName: String,
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    emailMode: { type: String, enum: ['full', 'mini'], default: 'full' },
    error: String,
  },
  { timestamps: true }
);

export default mongoose.model('OrderLog', orderLogSchema);