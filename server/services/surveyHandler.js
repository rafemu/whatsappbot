import Question from '../models/Question.js';
import SurveyResponse from '../models/SurveyResponse.js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const handleSurveyResponse = async (message, client, surveyResponse, conversation) => {
  try {
    console.log('Processing survey response for:', message.from);
    
    const currentQuestion = await Question.findById(surveyResponse.currentQuestionId)
      .populate('apiEndpointId');
      
    if (!currentQuestion) {
      throw new Error('השאלה הנוכחית לא נמצאה');
    }

    // Process response based on question type
    const responseData = await processResponse(message, currentQuestion, client);
    if (!responseData.isValid) {
      await client.sendMessage(message.from, responseData.message);
      
      conversation.messages.push({
        from: 'bot',
        content: responseData.message,
        timestamp: new Date()
      });
      
      await conversation.save();
      return;
    }

    // Save response
    surveyResponse.responses.push({
      questionId: currentQuestion._id,
      answer: responseData.answer,
      imageUrl: responseData.imageUrl,
      answeredAt: new Date()
    });

    // Get next question
    const nextQuestion = await getNextQuestion(currentQuestion, surveyResponse);
    if (nextQuestion) {
      surveyResponse.currentQuestionId = nextQuestion._id;
      await surveyResponse.save();
      
      let questionText = nextQuestion.text;
      
      if (nextQuestion.responseOptions && nextQuestion.responseOptions.length > 0) {
        questionText += '\n\nאפשרויות תשובה:\n' + 
          nextQuestion.responseOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      }
      
      await client.sendMessage(message.from, questionText);
      
      conversation.messages.push({
        from: 'bot',
        content: questionText,
        timestamp: new Date()
      });
    } else {
      // Survey completed
      surveyResponse.isCompleted = true;
      surveyResponse.completedAt = new Date();
      await surveyResponse.save();
      
      const completionMessage = 'תודה שהשלמת את הסקר! התשובות שלך נשמרו בהצלחה.';
      await client.sendMessage(message.from, completionMessage);
      
      conversation.messages.push({
        from: 'bot',
        content: completionMessage,
        timestamp: new Date()
      });
    }
    
    await conversation.save();
  } catch (error) {
    console.error('Error handling survey response:', error);
    throw error;
  }
};

const processResponse = async (message, question, client) => {
  console.log('Processing response for question type:', question.types);
  
  // Handle API type questions
  if (question.types.includes('api')) {
    if (message.body.toLowerCase() === 'כן') {
      try {
        // Send processing message
        await client.sendMessage(message.from, question.apiMessages.processingMessage);
        
        // Make API call
        const response = await axios.post('http://localhost:3001/api/clearing-house-checks', {
          phone: message.from,
          endpointId: question.apiEndpointId._id,
          requestData: {
            message: message.body,
            timestamp: new Date()
          }
        });
        
        return {
          isValid: true,
          answer: JSON.stringify(response.data),
          message: 'הבדיקה הושלמה בהצלחה'
        };
      } catch (error) {
        console.error('API call failed:', error);
        return {
          isValid: false,
          message: 'שגיאה בביצוע הבדיקה. אנא נסה שוב.'
        };
      }
    } else if (message.body.toLowerCase() === 'לא') {
      return {
        isValid: true,
        answer: 'declined',
        message: question.apiMessages.declineMessage
      };
    } else {
      return {
        isValid: false,
        message: question.apiMessages.confirmationMessage
      };
    }
  }

  // Handle image type questions
  if (question.types.includes('image')) {
    if (!message.hasMedia) {
      return {
        isValid: false,
        message: 'אנא שלח תמונה'
      };
    }

    try {
      const media = await message.downloadMedia();
      const fileName = `${Date.now()}_${message.from}.${media.mimetype.split('/')[1]}`;
      const filePath = path.join(__dirname, '../../uploads', fileName);
      
      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Save the image
      fs.writeFileSync(filePath, media.data, 'base64');
      
      return {
        isValid: true,
        answer: 'image uploaded',
        imageUrl: `/uploads/${fileName}`,
        message: 'התמונה נשמרה בהצלחה'
      };
    } catch (error) {
      console.error('Error saving image:', error);
      return {
        isValid: false,
        message: 'שגיאה בשמירת התמונה. אנא נסה שוב.'
      };
    }
  }

  // Handle options type questions
  if (question.types.includes('options')) {
    const answer = message.body.trim();
    if (!question.responseOptions.includes(answer)) {
      return {
        isValid: false,
        message: `אנא בחר מהאפשרויות הבאות:\n${question.responseOptions.join('\n')}`
      };
    }
    return {
      isValid: true,
      answer,
      message: 'תודה על תשובתך'
    };
  }

  // Handle text type questions (default)
  return {
    isValid: true,
    answer: message.body,
    message: 'תודה על תשובתך'
  };
};

const getNextQuestion = async (currentQuestion, surveyResponse) => {
  try {
    // Get all active questions sorted by order
    const questions = await Question.find({ active: true })
      .sort({ order: 1 });
    
    // Find current question index
    const currentIndex = questions.findIndex(q => 
      q._id.toString() === currentQuestion._id.toString()
    );
    
    // Look for next question
    for (let i = currentIndex + 1; i < questions.length; i++) {
      const question = questions[i];
      
      // If question has conditions, check them
      if (question.conditions && question.conditions.length > 0) {
        const conditionsMet = await checkConditions(question.conditions, surveyResponse);
        if (!conditionsMet) continue;
      }
      
      return question;
    }
    
    return null; // No more questions
  } catch (error) {
    console.error('Error getting next question:', error);
    throw error;
  }
};

const checkConditions = async (conditions, surveyResponse) => {
  for (const condition of conditions) {
    const response = surveyResponse.responses.find(r => 
      r.questionId.toString() === condition.questionId.toString()
    );
    
    if (!response) return false;
    
    switch (condition.operator) {
      case 'equals':
        if (response.answer !== condition.answer) return false;
        break;
      case 'contains':
        if (!response.answer.includes(condition.answer)) return false;
        break;
      case 'not_equals':
        if (response.answer === condition.answer) return false;
        break;
    }
  }
  
  return true;
};