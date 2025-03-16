import mongoose from 'mongoose';

const surveyResponseSchema = new mongoose.Schema({
  phone: String,
  responses: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    answer: String,
    imageUrl: String,
    answeredAt: { type: Date, default: Date.now }
  }],
  currentQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  isCompleted: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
});

export default mongoose.model('SurveyResponse', surveyResponseSchema);