import mongoose from 'mongoose';

const lensTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
    },
    price: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

lensTypeSchema.index({ name: 'text' });

export default mongoose.model('LensType', lensTypeSchema);