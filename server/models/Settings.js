import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    orderRecipientEmail: { type: String, trim: true, lowercase: true, default: '' },
    smtpFromName: { type: String, trim: true, default: 'Cynert Optical' },
    smtpFromEmail: { type: String, trim: true, lowercase: true, default: '' },
    clinicName: { type: String, trim: true, default: 'Cynert Optical' },
    currency: { type: String, default: 'KES', maxlength: 8 },
    allowCustomRecipient: { type: Boolean, default: true },
    notifyOnFailures: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) doc = await this.create({ key: 'global' });
  return doc;
};

export default mongoose.model('Settings', settingsSchema);