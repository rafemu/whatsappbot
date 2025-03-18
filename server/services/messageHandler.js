import Conversation from '../models/Conversation.js';
import Question from '../models/Question.js';
import SurveyResponse from '../models/SurveyResponse.js';
import WelcomeMessage from '../models/WelcomeMessage.js';
import { handleSurveyResponse } from './surveyHandler.js';

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

const startSurvey = async (phone, client, conversation) => {
  try {
    // Get the first active question
    const firstQuestion = await Question.findOne({ 
      active: true,
      order: 0 
    });

    if (!firstQuestion) {
      throw new Error('לא נמצאו שאלות פעילות');
    }

    // Create new survey response
    const newSurvey = new SurveyResponse({
      phone,
      currentQuestionId: firstQuestion._id,
      responses: [],
      startedAt: new Date()
    });
    await newSurvey.save();

    // Prepare question text
    let questionText = firstQuestion.text;
    
    if (firstQuestion.types.includes('options') && firstQuestion.responseOptions.length > 0) {
      questionText += '\n\nאפשרויות תשובה:\n' + 
        firstQuestion.responseOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    } else if (firstQuestion.types.includes('image')) {
      questionText += '\n\nאנא שלחו תמונה.';
    } else if (firstQuestion.types.includes('api')) {
      questionText += '\n\nהאם ברצונך להמשיך?\nכן / לא';
    }

    // Send the first question
    await client.sendMessage(phone, questionText);
    
    conversation.messages.push({
      from: 'bot',
      content: questionText,
      timestamp: new Date()
    });
    
    await conversation.save();
  } catch (error) {
    console.error('Error starting survey:', error);
    throw error;
  }
};

export const handleMessage = async (message, client) => {
  try {
    console.log('Processing message from:', message.from);
    
    // Find or create conversation
    let conversation = await Conversation.findOne({ phone: message.from });
    let isNewConversation = false;

    if (!conversation) {
      conversation = new Conversation({
        phone: message.from,
        messages: []
      });
      isNewConversation = true;
    }
    
    // Add user's message to conversation
    conversation.messages.push({
      from: 'user',
      content: message.body,
      timestamp: new Date()
    });
    
    await conversation.save();

    // Check if user is in an active survey
    const activeSurvey = await SurveyResponse.findOne({ 
      phone: message.from,
      isCompleted: false
    }).populate('currentQuestionId');

    // If this is a new conversation, send welcome message and start survey
    if (isNewConversation) {
      try {
        // Send welcome message
        const welcomeMessage = await getWelcomeMessage();
        await client.sendMessage(message.from, welcomeMessage);
        
        conversation.messages.push({
          from: 'bot',
          content: welcomeMessage,
          timestamp: new Date()
        });
        
        await conversation.save();

        // Add a small delay before starting the survey
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start the survey immediately
        await startSurvey(message.from, client, conversation);
      } catch (error) {
        console.error('Error in welcome flow:', error);
        throw error;
      }
    } else if (activeSurvey) {
      // Continue with existing survey
      await handleSurveyResponse(message, client, activeSurvey, conversation);
    } else {
      // Start a new survey if there isn't one active
      await startSurvey(message.from, client, conversation);
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