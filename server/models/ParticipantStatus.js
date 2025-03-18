import mongoose from 'mongoose';

const participantStatusSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true // Remove duplicate index definition
  },
  surveyStatus: {
    type: String,
    enum: ['complete', 'incomplete', 'not_started'],
    default: 'not_started',
    index: true // Add index here instead
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  callAttempts: {
    count: {
      type: Number,
      default: 0
    },
    lastAttempt: Date,
    history: [{
      timestamp: Date,
      duration: Number
    }]
  },
  followUpStatus: {
    attempts: {
      type: Number,
      default: 0
    },
    lastAttempt: Date,
    nextScheduled: {
      type: Date,
      index: true // Add index here instead
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    }
  },
  survey: {
    startedAt: Date,
    completedAt: Date,
    lastQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    completionPercentage: {
      type: Number,
      default: 0
    },
    responses: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      answer: String,
      timestamp: Date
    }]
  }
}, {
  timestamps: true
});

// Remove duplicate index definitions and use schema-level indexes
// participantStatusSchema.index({ phoneNumber: 1 }); // Removed as it's defined in the schema
// participantStatusSchema.index({ 'followUpStatus.nextScheduled': 1 }); // Removed as it's defined in the schema
// participantStatusSchema.index({ surveyStatus: 1 }); // Removed as it's defined in the schema

// Method to format data for external APIs
participantStatusSchema.methods.formatForAPI = function() {
  return {
    phoneNumber: this.phoneNumber,
    surveyStatus: this.surveyStatus,
    lastInteraction: this.lastInteraction,
    callAttempts: this.callAttempts.count,
    followUpStatus: this.followUpStatus.status,
    completionPercentage: this.survey.completionPercentage
  };
};

// Method to update completion percentage
participantStatusSchema.methods.updateCompletionPercentage = async function(totalQuestions) {
  const answered = this.survey.responses.length;
  this.survey.completionPercentage = (answered / totalQuestions) * 100;
  await this.save();
};

export default mongoose.model('ParticipantStatus', participantStatusSchema);