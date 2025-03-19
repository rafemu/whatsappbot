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
    const responseData = await processResponse(message, currentQuestion, surveyResponse);
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
      
      if (nextQuestion.types.includes('options') && nextQuestion.responseOptions.length > 0) {
        questionText += '\n\nאפשרויות תשובה:\n' + 
          nextQuestion.responseOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      } else if (nextQuestion.types.includes('image')) {
        questionText += '\n\nאנא שלחו תמונה.';
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
      
      const completionMessage ='شكرا سوف نتواصل معك من الساعه 09:30 ولغاية الساعه 15:30 كل ايام الاسبوع ما عادا جمعه سبت😊'
      //  'תודה רבה! השלמת את כל השאלות בהצלחה. 🎉\nהמידע שמסרת נשמר במערכת.';
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

const processResponse = async (message, question, surveyResponse) => {
  console.log('Processing response for question type:', question.types);
  
  // Handle API type questions
  if (question.types.includes('api')) {
    try {
      // Prepare API request data based on mapping
      const requestData = {};
      
      // Process each mapping entry
      for (const mapping of question.apiDataMapping) {
        let value = '';
        
        switch (mapping.source) {
          case 'question':
            // Get answer from a specific question
            if (mapping.value === question._id.toString()) {
              // If mapping refers to current question, use current answer
              value = message.body;
            } else {
              // Get answer from previous question
              const previousResponse = surveyResponse.responses.find(r => 
                r.questionId.toString() === mapping.value
              );
              if (previousResponse) {
                value = previousResponse.answer;
              }
            }
            break;
            
          case 'static':
            // Use static value directly
            value = mapping.value;
            break;
            
          case 'phone':
            // Use phone number (remove @c.us suffix)
            value = message.from.replace('@c.us', '');
            break;
        }
        
        // Only add to requestData if we have a value
        if (value) {
          requestData[mapping.key] = value;
        }
      }

      console.log('Making API call with data:', requestData);

      // Make API call
      const response = await axios({
        method: 'post',
        url: question.apiEndpointId.url,
        data: requestData,
        headers: {
          'Cookie': 'device_view=full',
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      });
      
      return {
        isValid: true,
        answer: JSON.stringify(response.data)
      };
    } catch (error) {
      console.error('API call failed:', error);
      return {
        isValid: false,
        message: 'שגיאה בשליחת הבקשה. אנא נסה שוב.'
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
        imageUrl: `/uploads/${fileName}`
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
      answer
    };
  }

  // Handle text type questions (default)
  return {
    isValid: true,
    answer: message.body
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

export const startSurvey = async (phone, client, conversation) => {
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