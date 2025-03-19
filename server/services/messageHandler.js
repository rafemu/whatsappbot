import Conversation from '../models/Conversation.js';
import Question from '../models/Question.js';
import SurveyResponse from '../models/SurveyResponse.js';
import WelcomeMessage from '../models/WelcomeMessage.js';
import { handleSurveyResponse, startSurvey } from './surveyHandler.js';
import ParticipantStatus from '../models/ParticipantStatus.js';

const getWelcomeMessage = async () => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // Find all active welcome messages
  const messages = await WelcomeMessage.find({ active: true });
  
  for (const message of messages) {
    let isValid = true;
    
    // Check all conditions
    for (const condition of message.conditions || []) {
      switch (condition.field) {
        case 'time':
          if (condition.operator === 'between') {
            const [start, end] = condition.value.split('-').map(Number);
            const [start2, end2] = (condition.value2 || '').split('-').map(Number);
            if (!(hour >= start && hour <= end) && !(hour >= start2 && hour <= end2)) {
              isValid = false;
            }
          } else if (condition.operator === 'equals') {
            if (hour !== parseInt(condition.value)) {
              isValid = false;
            }
          }
          break;
          
        case 'day':
          if (condition.operator === 'equals') {
            if (day !== parseInt(condition.value)) {
              isValid = false;
            }
          }
          break;
      }
      
      if (!isValid) break;
    }
    
    if (isValid) {
      return message.text;
    }
  }
  
  // Return default message if no conditions match
  return 'ברוכים הבאים לבוט השירות שלנו! 👋';
};

export const handleMessage = async (message, client) => {
  try {
    const { from, body } = message;
    
    // Get or create conversation
    let conversation = await Conversation.findOne({ phone: from });
    if (!conversation) {
      conversation = await Conversation.create({
        phone: from,
        messages: []
      });
    }

    // Add user message to conversation
    conversation.messages.push({
      from: 'user',
      content: body,
      timestamp: new Date()
    });
    await conversation.save();

    // Check if user has completed the survey
    const participantStatus = await ParticipantStatus.findOne({ phoneNumber: from });
    if (participantStatus && participantStatus.surveyStatus === 'complete') {
      // User has completed the survey, send appropriate message
      const responseMessage = 'כבר סיימת את השאלון. במה אפשר לעזור?';
      await client.sendMessage(from, responseMessage);
      
      conversation.messages.push({
        from: 'bot',
        content: responseMessage,
        timestamp: new Date()
      });
      
      await conversation.save();
      return;
    }

    // Check for active survey response
    let surveyResponse = await SurveyResponse.findOne({
      phone: from,
      isCompleted: false
    });

    // Check if user is in an active survey
    if (surveyResponse) {
      // Continue with existing survey
      await handleSurveyResponse(message, client, surveyResponse, conversation);
    } else {
      // Start a new survey if there isn't one active
      await startSurvey(from, client, conversation);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    try {
      await client.sendMessage(
        message.from, 
        'אירעה שגיאה בעיבוד ההודעה. אנא נסה שוב מאוחר יותר.'
      );
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
  }
};