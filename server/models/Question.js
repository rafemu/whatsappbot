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
    enum: ['text', 'options', 'image', 'api'],
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
    ref: 'ApiEndpoint'
  },
  apiDataMapping: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      enum: ['question', 'static', 'phone'],
      required: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    }
  }]
}, { timestamps: true });

// Pre-save middleware to validate API configuration
questionSchema.pre('save', function(next) {
  // Initialize arrays if they don't exist
  this.apiDataMapping = this.apiDataMapping || [];
  this.types = this.types || [];

  // If question type includes 'api', validate required fields
  if (this.types.includes('api')) {
    // Validate API endpoint
    if (!this.apiEndpointId) {
      return next(new Error('API endpoint is required when type includes "api"'));
    }

    // Validate API data mapping
    if (!Array.isArray(this.apiDataMapping)) {
      return next(new Error('API data mapping must be an array'));
    }

    if (this.apiDataMapping.length === 0) {
      return next(new Error('At least one API data mapping is required when type includes "api"'));
    }

    // Validate each mapping
    for (const mapping of this.apiDataMapping) {
      if (!mapping || typeof mapping !== 'object') {
        return next(new Error('Invalid API mapping format'));
      }

      if (!mapping.key || typeof mapping.key !== 'string' || !mapping.key.trim()) {
        return next(new Error('API mapping key is required and must be a non-empty string'));
      }

      if (!mapping.source || !['question', 'static', 'phone'].includes(mapping.source)) {
        return next(new Error('API mapping source must be one of: question, static, phone'));
      }

      if (!mapping.value || typeof mapping.value !== 'string' || !mapping.value.trim()) {
        return next(new Error('API mapping value is required and must be a non-empty string'));
      }
    }
  } else {
    // If type doesn't include 'api', clear API-related fields
    this.apiEndpointId = undefined;
    this.apiDataMapping = [];
  }
  
  next();
});

const Question = mongoose.model('Question', questionSchema);

export default Question;