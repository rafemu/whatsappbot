import mongoose from 'mongoose';

const botStatusSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false
  },
  connectedPhone: {
    type: String,
    default: null
  },
  lastConnection: {
    type: Date,
    default: null
  },
  lastDisconnection: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('BotStatus', botStatusSchema);