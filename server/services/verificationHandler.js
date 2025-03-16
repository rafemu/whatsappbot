import IdVerification from '../models/IdVerification.js';
import Question from '../models/Question.js';
import SurveyResponse from '../models/SurveyResponse.js';

export const handleIdVerification = async (message, client, conversation) => {
  try {
    console.log('Processing ID verification for:', message.from);
    const idNumber = message.body.trim();
    
    // Mock verification result (replace with actual API call)
    const verificationResult = await mockVerifyIsraeliId(idNumber);
    
    // Save verification result
    const verification = new IdVerification({
      phone: message.from,
      idNumber: idNumber,
      verificationResult: verificationResult
    });
    
    await verification.save();
    
    // Prepare response message
    let responseText = verificationResult.valid 
      ? 'תעודת הזהות אומתה בהצלחה!\n\n' 
      : 'תעודת הזהות אינה תקינה. אנא נסה שנית.\n\n';

    // If verification successful, start survey
    if (verificationResult.valid) {
      const firstQuestion = await Question.findOne({ 
        active: true,
        order: 0 
      });

      if (firstQuestion) {
        // Create new survey response
        const newSurvey = new SurveyResponse({
          phone: message.from,
          currentQuestionId: firstQuestion._id,
          responses: [],
          startedAt: new Date()
        });
        await newSurvey.save();

        // Add question text to response
        responseText += firstQuestion.text;
        
        if (firstQuestion.responseOptions && firstQuestion.responseOptions.length > 0) {
          responseText += '\n\nאפשרויות תשובה:\n' + 
            firstQuestion.responseOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
        }
      }
    }
    
    // Send response
    await client.sendMessage(message.from, responseText);
    
    conversation.messages.push({
      from: 'bot',
      content: responseText,
      timestamp: new Date()
    });
    
    await conversation.save();
  } catch (error) {
    console.error('Error handling ID verification:', error);
    throw error;
  }
};

// Mock function for ID verification (replace with actual API call)
const mockVerifyIsraeliId = async (idNumber) => {
  const id = String(idNumber).trim();
  if (id.length !== 9 || isNaN(id)) return { valid: false, reason: 'פורמט לא תקין' };
  
  const digits = id.split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    let digit = digits[i];
    if (i % 2 === 0) {
      digit *= 1;
    } else {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return {
    valid: sum % 10 === 0,
    idNumber,
    checkDate: new Date().toISOString(),
    reason: sum % 10 === 0 ? 'תעודת זהות תקינה' : 'בדיקת סיכום נכשלה'
  };
};