import mongoose from 'mongoose';

const idVerificationSchema = new mongoose.Schema({
  phone: String,
  idNumber: String,
  verificationResult: {
    valid: Boolean,
    idNumber: String,
    checkDate: String,
    reason: String
  },
  verifiedAt: { type: Date, default: Date.now }
});

export default mongoose.model('IdVerification', idVerificationSchema);