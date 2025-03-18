import mongoose from 'mongoose';

const welcomeMessageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    default: 'ברוכים הבאים לבוט השירות שלנו! 👋\nאנא הזינו את מספר תעודת הזהות שלכם (9 ספרות) להתחלת התהליך.'
  },
  active: {
    type: Boolean,
    default: true
  },
  conditions: [{
    field: {
      type: String,
      enum: ['time', 'day', 'date'],
      required: true
    },
    operator: {
      type: String,
      enum: ['equals', 'greater_than', 'less_than', 'between'],
      required: true
    },
    value: {
      type: String,
      required: true
    },
    value2: String // For 'between' operator
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('WelcomeMessage', welcomeMessageSchema);