import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  phone: String,
  messages: [{
    from: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Conversation', conversationSchema);