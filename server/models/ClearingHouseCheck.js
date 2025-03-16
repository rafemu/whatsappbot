import mongoose from 'mongoose';

const clearingHouseCheckSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true 
  },
  endpointId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ApiEndpoint',
    required: true 
  },
  requestData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  responseData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  errorMessage: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  completedAt: Date
});

export default mongoose.model('ClearingHouseCheck', clearingHouseCheckSchema);