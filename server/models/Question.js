import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  responseOptions: {
    type: [String],
    default: []
  },
  active: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  types: {
    type: [String],
    enum: ['text', 'options', 'image', 'conditional', 'api'],
    default: ['text']
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  conditions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    answer: String,
    operator: {
      type: String,
      enum: ['equals', 'contains', 'not_equals'],
      default: 'equals'
    }
  }],
  apiEndpointId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiEndpoint',
    // Remove required validation since it's optional
     
  },
  apiMessages: {
    confirmationMessage: {
      type: String,
      default: 'האם ברצונך לבצע את הבדיקה?'
    },
    processingMessage: {
      type: String,
      default: 'הבדיקה החלה, אנא המתן...'
    },
    declineMessage: {
      type: String,
      default: 'הבדיקה בוטלה לבקשתך.'
    }
  }
}, { timestamps: true });

// Pre-save middleware to handle empty apiEndpointId
questionSchema.pre('save', function(next) {
  if (this.types.includes('api') && !this.apiEndpointId) {
    return next(new Error('API endpoint is required when type includes "api"'));
  }
  
  // If type doesn't include 'api', ensure apiEndpointId is null
  if (!this.types.includes('api')) {
    this.apiEndpointId = null;
  }
  
  next();
});

export default mongoose.model('Question', questionSchema);