import mongoose from 'mongoose';

const icd11CodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

icd11CodeSchema.index({ description: 'text' });

export default mongoose.model('ICD11Code', icd11CodeSchema);