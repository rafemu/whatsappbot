import Conversation from '../models/Conversation.js';
import Question from '../models/Question.js';
import SurveyResponse from '../models/SurveyResponse.js';
import { handleIdVerification } from './verificationHandler.js';
import { handleSurveyResponse } from './surveyHandler.js';

export const handleMessage = async (message, client) => {
  try {
    console.log('Received message:', message.body, 'from:', message.from);
    
    // Find or create conversation
    let conversation = await Conversation.findOne({ phone: message.from });
    if (!conversation) {
      conversation = new Conversation({
        phone: message.from,
        messages: []
      });
    }
    
    // Create a new messages array with the user's message
    const updatedMessages = [
      ...conversation.messages,
      {
        from: 'user',
        content: message.body,
        timestamp: new Date()
      }
    ];
    
    // Update conversation with new messages
    conversation.messages = updatedMessages;
    await conversation.save();

    // Check if user is in an active survey
    const activeSurvey = await SurveyResponse.findOne({ 
      phone: message.from,
      isCompleted: false
    }).populate('currentQuestionId');

    // Check if message is an ID number
    const idNumberRegex = /^\d{9}$/;
    if (idNumberRegex.test(message.body.trim())) {
      console.log('Processing ID verification...');
      await handleIdVerification(message, client, conversation);
    } else if (activeSurvey) {
      console.log('Processing survey response...');
      await handleSurveyResponse(message, client, activeSurvey, conversation);
    } else {
      // Start new survey if no active survey exists
      console.log('Starting new survey...');
      const firstQuestion = await Question.findOne({ 
        active: true,
        order: 0 
      });

      if (firstQuestion) {
        const newSurvey = new SurveyResponse({
          phone: message.from,
          currentQuestionId: firstQuestion._id,
          responses: [],
          startedAt: new Date()
        });
        await newSurvey.save();

        let response = `ברוך הבא לסקר!\n\n${firstQuestion.text}`;
        
        if (firstQuestion.responseOptions && firstQuestion.responseOptions.length > 0) {
          response += '\n\nאפשרויות תשובה:\n' + 
            firstQuestion.responseOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
        }

        await client.sendMessage(message.from, response);
        
        // Update conversation with bot's response
        conversation.messages.push({
          from: 'bot',
          content: response,
          timestamp: new Date()
        });
        
        await conversation.save();
      } else {
        const defaultResponse = 'ברוך הבא! אנא שלח את מספר תעודת הזהות שלך לאימות.';
        await client.sendMessage(message.from, defaultResponse);
        
        // Update conversation with bot's response
        conversation.messages.push({
          from: 'bot',
          content: defaultResponse,
          timestamp: new Date()
        });
        
        await conversation.save();
      }
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