// Import required modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('התחברות למסד הנתונים הצליחה'))
  .catch(err => console.error('שגיאה בהתחברות למסד הנתונים:', err));

// Define MongoDB schemas and models
const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  responseOptions: [String],
  active: { type: Boolean, default: true },
  type: { type: String, enum: ['text', 'options', 'image'], default: 'text' },
  order: { type: Number, default: 0 },
  isRequired: { type: Boolean, default: false }
});

const SurveyResponseSchema = new mongoose.Schema({
  phone: { type: String, required: true },
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

const ConversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  messages: [{
    from: { type: String, enum: ['user', 'bot'] },
    content: String,
    imageUrl: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const IdVerificationSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  idNumber: { type: String, required: true },
  status: { type: String, enum: ['pending', 'valid', 'invalid'], default: 'pending' },
  verificationResult: {
    valid: Boolean,
    idNumber: String,
    checkDate: String,
    reason: String
  },
  verifiedAt: { type: Date, default: Date.now }
});

const ApiEndpointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  description: String,
  headers: { type: Object, default: { 'Content-Type': 'application/json' } },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ApiCallSchema = new mongoose.Schema({
  type: { type: String, required: true },
  requestData: Object,
  responseData: Object,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  phone: String,
  idNumber: String,
  externalRequestId: String,
  errorMessage: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

const ConditionalQuestionSchema = new mongoose.Schema({
  baseQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  conditions: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    operator: { type: String, enum: ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith'], default: 'equals' },
    value: { type: String, required: true }
  }],
  nextQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  apiEndpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiEndpoint' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Question = mongoose.model('Question', QuestionSchema);
const SurveyResponse = mongoose.model('SurveyResponse', SurveyResponseSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const IdVerification = mongoose.model('IdVerification', IdVerificationSchema);
const ApiEndpoint = mongoose.model('ApiEndpoint', ApiEndpointSchema);
const ApiCall = mongoose.model('ApiCall', ApiCallSchema);
const ConditionalQuestion = mongoose.model('ConditionalQuestion', ConditionalQuestionSchema);

// WhatsApp client setup
let whatsappClient = null;
let botActive = false;
let qrCodeData = null;

// Initialize WhatsApp client
function initializeWhatsAppClient() {
  try {
    whatsappClient = new Client({
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    whatsappClient.on('qr', async (qr) => {
      console.log('התקבל קוד QR, ממתין לסריקה...');
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        io.emit('qrCode', qrCodeData);
      } catch (error) {
        console.error('שגיאה ביצירת קוד QR:', error);
      }
    });

    whatsappClient.on('ready', () => {
      console.log('WhatsApp מוכן!');
      botActive = true;
      qrCodeData = null;
      io.emit('botStatus', { active: true });
    });

    whatsappClient.on('authenticated', () => {
      console.log('אימות הצליח!');
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('שגיאת אימות:', msg);
      botActive = false;
      io.emit('botStatus', { active: false, error: 'שגיאת אימות: ' + msg });
    });

    whatsappClient.on('disconnected', (reason) => {
      console.log('WhatsApp התנתק:', reason);
      botActive = false;
      whatsappClient = null;
      io.emit('botStatus', { active: false });
    });

    whatsappClient.on('message', async (message) => {
      try {
        console.log(`התקבלה הודעה מ-${message.from}: ${message.body}`);
        
        // Check if this is a new conversation or get existing one
        let conversation = await Conversation.findOne({ phone: message.from });
        
        if (!conversation) {
          // Create new conversation
          conversation = new Conversation({
            phone: message.from,
            messages: []
          });
        }
        
        // Add user message to conversation
        if (message.hasMedia) {
          // Handle media message
          const media = await message.downloadMedia();
          
          if (media) {
            // Generate a unique filename
            const fileExtension = media.mimetype.split('/')[1];
            const filename = `${Date.now()}-${message.from.replace(/\D/g, '')}.${fileExtension}`;
            const filePath = path.join(uploadsDir, filename);
            
            // Convert base64 to buffer and save to file
            const fileData = Buffer.from(media.data, 'base64');
            fs.writeFileSync(filePath, fileData);
            
            // Create a URL for the saved image
            const imageUrl = `/uploads/${filename}`;
            
            conversation.messages.push({
              from: 'user',
              content: 'תמונה',
              imageUrl: imageUrl,
              timestamp: new Date()
            });
          } else {
            conversation.messages.push({
              from: 'user',
              content: '[מדיה לא נתמכת]',
              timestamp: new Date()
            });
          }
        } else {
          // Handle text message
          conversation.messages.push({
            from: 'user',
            content: message.body,
            timestamp: new Date()
          });
        }
        
        await conversation.save();
        
        // Emit updated conversation to frontend
        io.emit('conversationUpdate', conversation);
        
        // Check if there's an active survey for this user
        const surveyResponse = await SurveyResponse.findOne({ 
          phone: message.from,
          isCompleted: false
        });
        
        if (surveyResponse) {
          // User is in the middle of a survey
          if (message.hasMedia) {
            await processMediaResponse(message, surveyResponse);
          } else {
            await processSurveyResponse(message, surveyResponse);
          }
        } else {
          // Check if message is a command
          const lowerCaseBody = message.body.toLowerCase();
          
          if (lowerCaseBody === 'סקר' || lowerCaseBody === 'התחל' || lowerCaseBody === 'start') {
            // Start a new survey
            await startSurvey(message.from);
          } else if (lowerCaseBody === 'כן' || lowerCaseBody === 'אימות' || lowerCaseBody === 'verify') {
            // Start ID verification process
            await whatsappClient.sendMessage(
              message.from, 
              'אנא הזן את מספר תעודת הזהות שלך (9 ספרות):'
            );
            
            // Add bot message to conversation
            conversation.messages.push({
              from: 'bot',
              content: 'אנא הזן את מספר תעודת הזהות שלך (9 ספרות):',
              timestamp: new Date()
            });
            
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          } else if (lowerCaseBody.match(/^\d{9}$/)) {
            // This looks like an ID number, verify it
            await verifyId(message.from, message.body);
            
            // Add bot acknowledgment to conversation
            conversation.messages.push({
              from: 'bot',
              content: 'תודה, מספר תעודת הזהות נשלח לבדיקה. תקבל עדכון בהקדם.',
              timestamp: new Date()
            });
            
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          } else if (lowerCaseBody === 'מסלקה' || lowerCaseBody === 'clearing') {
            // Start clearing house check
            await whatsappClient.sendMessage(
              message.from, 
              'אנא הזן את מספר תעודת הזהות שלך לבדיקת מסלקה:'
            );
            
            // Add bot message to conversation
            conversation.messages.push({
              from: 'bot',
              content: 'אנא הזן את מספר תעודת הזהות שלך לבדיקת מסלקה:',
              timestamp: new Date()
            });
            
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          } else if (lowerCaseBody === 'עזרה' || lowerCaseBody === 'help') {
            // Send help message
            const helpMessage = 
              'פקודות זמינות:\n' +
              '- סקר / התחל - להתחלת סקר חדש\n' +
              '- אימות - לאימות תעודת זהות\n' +
              '- מסלקה - לבדיקת מסלקה\n' +
              '- עזרה - להצגת הודעה זו';
            
            await whatsappClient.sendMessage(message.from, helpMessage);
            
            // Add bot message to conversation
            conversation.messages.push({
              from: 'bot',
              content: helpMessage,
              timestamp: new Date()
            });
            
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          } else {
            // Check if this might be an ID for clearing house check
            // This is a simple check - in production you'd want more robust validation
            if (message.body.match(/^\d{9}$/) && conversation.messages.length >= 2) {
              const previousMessage = conversation.messages[conversation.messages.length - 2];
              if (previousMessage.from === 'bot' && previousMessage.content.includes('בדיקת מסלקה')) {
                // This is likely a response to the clearing house check prompt
                await checkClearingHouse(message.from, message.body);
                
                // Add bot acknowledgment to conversation
                conversation.messages.push({
                  from: 'bot',
                  content: 'תודה, הבקשה נשלחה לבדיקת מסלקה. תקבל עדכון בהקדם.',
                  timestamp: new Date()
                });
                
                await conversation.save();
                
                // Emit updated conversation to frontend
                io.emit('conversationUpdate', conversation);
                return;
              }
            }
            
            // Default response for unrecognized messages
            await whatsappClient.sendMessage(
              message.from, 
              'שלום! אני בוט אוטומטי. הקלד "עזרה" לרשימת הפקודות הזמינות.'
            );
            
            // Add bot message to conversation
            conversation.messages.push({
              from: 'bot',
              content: 'שלום! אני בוט אוטומטי. הקלד "עזרה" לרשימת הפקודות הזמינות.',
              timestamp: new Date()
            });
            
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          }
        }
      } catch (error) {
        console.error('שגיאה בטיפול בהודעה:', error);
      }
    });

    whatsappClient.initialize();
  } catch (error) {
    console.error('שגיאה באתחול WhatsApp:', error);
    io.emit('botStatus', { active: false, error: 'שגיאה באתחול WhatsApp: ' + error.message });
  }
}

// Function to verify ID
async function verifyId(phone, idNumber) {
  try {
    // Create a verification record
    const verification = new IdVerification({
      phone,
      idNumber,
      status: 'pending'
    });
    
    await verification.save();
    
    // Create an API call record
    const apiCall = new ApiCall({
      type: 'id-verification',
      requestData: { idNumber },
      status: 'pending',
      phone,
      idNumber
    });
    
    await apiCall.save();
    
    // Send message to user
    await whatsappClient.sendMessage(
      phone, 
      'תודה, מספר תעודת הזהות נשלח לבדיקה. תקבל עדכון בהקדם.'
    );
    
    // Call external API (async)
    verifyIdWithExternalApi(idNumber, apiCall._id, verification._id, phone);
    
    return verification;
  } catch (error) {
    console.error('שגיאה באימות תעודת זהות:', error);
    await whatsappClient.sendMessage(
      phone, 
      'אירעה שגיאה באימות תעודת הזהות. אנא נסה שוב מאוחר יותר.'
    );
    return null;
  }
}

// Function to check clearing house
async function checkClearingHouse(phone, idNumber) {
  try {
    // Create an API call record
    const apiCall = new ApiCall({
      type: 'clearing-house',
      requestData: { idNumber },
      status: 'pending',
      phone,
      idNumber
    });
    
    await apiCall.save();
    
    // Send message to user
    await whatsappClient.sendMessage(
      phone, 
      'תודה, הבקשה נשלחה לבדיקת מסלקה. תקבל עדכון בהקדם.'
    );
    
    // Call mock clearing house API (async)
    checkClearingHouseWithExternalApi(idNumber, apiCall._id, phone);
    
    return apiCall;
  } catch (error) {
    console.error('שגיאה בבדיקת מסלקה:', error);
    await whatsappClient.sendMessage(
      phone, 
      'אירעה שגיאה בבדיקת המסלקה. אנא נסה שוב מאוחר יותר.'
    );
    return null;
  }
}

// Mock function for ID verification API call
async function verifyIdWithExternalApi(idNumber, apiCallId, verificationId, phone) {
  try {
    console.log(`מבצע אימות תעודת זהות ${idNumber}, מזהה קריאת API: ${apiCallId}`);
    
    // Generate a unique request ID
    const requestId = `ID-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Update API call with request ID
    await ApiCall.findByIdAndUpdate(apiCallId, { externalRequestId: requestId });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 4000));
    
    // Perform ID validation (this is a simple check - in production you'd call a real API)
    const result = mockIdValidation(idNumber, requestId);
    
    // Update API call record
    await ApiCall.findByIdAndUpdate(apiCallId, {
      status: 'completed',
      responseData: result,
      completedAt: new Date()
    });
    
    // Update verification record
    await IdVerification.findByIdAndUpdate(verificationId, {
      status: result.isValid ? 'valid' : 'invalid',
      verificationResult: {
        valid: result.isValid,
        idNumber: idNumber,
        checkDate: new Date().toISOString(),
        reason: result.isValid ? 'תעודת זהות תקינה' : 'תעודת זהות לא תקינה'
      }
    });
    
    // Send result to user
    const resultMessage = result.isValid 
      ? 'אימות תעודת הזהות הצליח. תעודת הזהות תקינה.'
      : 'אימות תעודת הזהות נכשל. תעודת הזהות אינה תקינה.';
    
    await whatsappClient.sendMessage(phone, resultMessage);
    
    // Update conversation with the result
    let conversation = await Conversation.findOne({ phone });
    if (conversation) {
      conversation.messages.push({
        from: 'bot',
        content: resultMessage,
        timestamp: new Date()
      });
      
      await conversation.save();
      
      // Emit updated conversation to frontend
      io.emit('conversationUpdate', conversation);
    }
    
    // Emit API call update to frontend
    io.emit('apiCallUpdate', await ApiCall.findById(apiCallId));
    
  } catch (error) {
    console.error('שגיאה בקריאת API לאימות תעודת זהות:', error);
    
    // Update API call record with error
    await ApiCall.findByIdAndUpdate(apiCallId, {
      status: 'failed',
      errorMessage: `שגיאה בקריאת API: ${error.message}`,
      completedAt: new Date()
    });
    
    // Emit API call update to frontend
    io.emit('apiCallUpdate', await ApiCall.findById(apiCallId));
  }
}

// Mock function for clearing house API call
async function checkClearingHouseWithExternalApi(idNumber, apiCallId, phone) {
  try {
    console.log(`מבצע בדיקת מסלקה עבור ת.ז ${idNumber}, מזהה קריאת API: ${apiCallId}`);
    
    // Generate a unique request ID
    const requestId = `CH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Update API call with request ID
    await ApiCall.findByIdAndUpdate(apiCallId, { externalRequestId: requestId });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
    
    // Perform mock clearing house check
    const result = await mockClearingHouseApiCall({ idNumber }, requestId);
    
    // Update API call record
    await ApiCall.findByIdAndUpdate(apiCallId, {
      status: 'completed',
      responseData: result,
      completedAt: new Date()
    });
    
    // Send result to user
    await whatsappClient.sendMessage(phone, result.message);
    
    // Update conversation with the result
    let conversation = await Conversation.findOne({ phone });
    if (conversation) {
      conversation.messages.push({
        from: 'bot',
        content: result.message,
        timestamp: new Date()
      });
      
      await conversation.save();
      
      // Emit updated conversation to frontend
      io.emit('conversationUpdate', conversation);
    }
    
    // Emit API call update to frontend
    io.emit('apiCallUpdate', await ApiCall.findById(apiCallId));
    
  } catch (error) {
    console.error('שגיאה בקריאת API למסלקה:', error);
    
    // Update API call record with error
    await ApiCall.findByIdAndUpdate(apiCallId, {
      status: 'failed',
      errorMessage: `שגיאה בקריאת API: ${error.message}`,
      completedAt: new Date()
    });
    
    // Emit API call update to frontend
    io.emit('apiCallUpdate', await ApiCall.findById(apiCallId));
  }
}

// Function to make API call based on endpoint ID
async function makeApiCall(endpointId, data, phone) {
  try {
    // Get the API endpoint
    const endpoint = await ApiEndpoint.findById(endpointId);
    if (!endpoint || !endpoint.active) {
      throw new Error('נקודת קצה API לא נמצאה או לא פעילה');
    }
    
    // Create an API call record
    const apiCall = new ApiCall({
      type: endpoint.name,
      requestData: data,
      status: 'pending',
      phone
    });
    
    await apiCall.save();
    
    // In a real implementation, you would make an actual HTTP request here
    // For this demo, we'll simulate the API call
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Generate mock response
    const response = {
      success: Math.random() > 0.3, // 70% success rate
      message: Math.random() > 0.3 ? 'הבקשה התקבלה בהצלחה' : 'הבקשה נדחתה',
      timestamp: new Date().toISOString(),
      requestId: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    
    // Update API call record
    await ApiCall.findByIdAndUpdate(apiCall._id, {
      status: 'completed',
      responseData: response,
      externalRequestId: response.requestId,
      completedAt: new Date()
    });
    
    // Emit API call update to frontend
    io.emit('apiCallUpdate', await ApiCall.findById(apiCall._id));
    
    return response;
  } catch (error) {
    console.error('שגיאה בביצוע קריאת API:', error);
    
    // Update API call record with error
    if (apiCall) {
      await ApiCall.findByIdAndUpdate(apiCall._id, {
        status: 'failed',
        errorMessage: `שגיאה בקריאת API: ${error.message}`,
        completedAt: new Date()
      });
      
      // Emit API call update to frontend
      io.emit('apiCallUpdate', await ApiCall.findById(apiCall._id));
    }
    
    throw error;
  }
}

// Mock function for ID validation
function mockIdValidation(idNumber, requestId) {
  // This is a simple implementation of the Luhn algorithm for ID validation
  // In a real system, you would call an actual ID verification service
  
  let isValid = false;
  
  // Basic length check
  if (idNumber.length === 9 && !isNaN(id)) {
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
    
    isValid = sum % 10 === 0;
  }
  
  // Mock response structure - adjust based on actual API
  return {
    requestId: requestId,
    idNumber: idNumber,
    isValid: isValid,
    timestamp: new Date().toISOString(),
    details: {
      checkType: 'id-verification',
      algorithmVersion: '1.0',
      checkResult: isValid ? 'VALID' : 'INVALID'
    }
  };
}

// Mock function for clearing house API call
async function mockClearingHouseApiCall(data, requestId) {
  // This is a mock function - replace with actual API call in production
  console.log(`מבצע קריאת API מדומה למסלקה, מזהה בקשה: ${requestId}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 4000));
  
  // Generate random status
  const statuses = ['APPROVED', 'REJECTED', 'PENDING_REVIEW'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  // Generate appropriate message based on status
  let message = '';
  switch (randomStatus) {
    case 'APPROVED':
      message = 'הבקשה אושרה במסלקה. ניתן להמשיך בתהליך.';
      break;
    case 'REJECTED':
      message = 'הבקשה נדחתה במסלקה. נא לפנות לנציג שירות.';
      break;
    case 'PENDING_REVIEW':
      message = 'הבקשה ממתינה לבדיקה נוספת במסלקה. נציג יצור קשר בהקדם.';
      break;
  }
  
  // Mock response structure - adjust based on actual API
  return {
    requestId: requestId,
    status: randomStatus,
    message: message,
    timestamp: new Date().toISOString(),
    details: {
      checkType: 'clearing-house',
      requestData: data,
      additionalInfo: 'מידע נוסף יישלח בהמשך במידת הצורך'
    }
  };
}

// Function to start a new survey for a user
async function startSurvey(phone) {
  try {
    // Get all active questions ordered by their order field
    const questions = await Question.find({ active: true }).sort({ order: 1 });
    
    if (questions.length === 0) {
      await whatsappClient.sendMessage(phone, 'אין שאלות פעילות בסקר כרגע. אנא נסה שוב מאוחר יותר.');
      return;
    }
    
    // Check if there's already an active survey for this user
    let surveyResponse = await SurveyResponse.findOne({ 
      phone: phone,
      isCompleted: false
    });
    
    if (!surveyResponse) {
      // Create a new survey response
      surveyResponse = new SurveyResponse({
        phone: phone,
        responses: [],
        currentQuestionId: questions[0]._id,
        startedAt: new Date()
      });
      
      await surveyResponse.save();
    }
    
    // Get the current question
    const currentQuestion = await Question.findById(surveyResponse.currentQuestionId);
    
    if (!currentQuestion) {
      // If current question doesn't exist, use the first question
      surveyResponse.currentQuestionId = questions[0]._id;
      await surveyResponse.save();
      await sendQuestion(phone, questions[0]);
    } else {
      // Send the current question
      await sendQuestion(phone, currentQuestion);
    }
  } catch (error) {
    console.error('שגיאה בהתחלת סקר:', error);
    await whatsappClient.sendMessage(phone, 'אירעה שגיאה בהתחלת הסקר. אנא נסה שוב מאוחר יותר.');
  }
}

// Function to send a question to the user
async function sendQuestion(phone, question) {
  let messageText = question.text;
  
  if (question.type === 'options' && question.responseOptions && question.responseOptions.length > 0) {
    messageText += '\n\nאפשרויות תשובה:\n' + question.responseOptions.map((opt, index) => 
      `${index + 1}. ${opt}`
    ).join('\n');
    
    messageText += '\n\nאנא השב במספר האפשרות או בטקסט מלא.';
  } else if (question.type === 'image') {
    messageText += '\n\nאנא שלח תמונה כתשובה לשאלה זו.';
  }
  
  await whatsappClient.sendMessage(phone, messageText);
}

// Function to process a survey response
async function processSurveyResponse(message, surveyResponse) {
  try {
    // Get the current question
    const currentQuestion = await Question.findById(surveyResponse.currentQuestionId);
    
    if (!currentQuestion) {
      await whatsappClient.sendMessage(message.from, 'אירעה שגיאה בעיבוד התשובה. אנא נסה שוב מאוחר יותר.');
      return;
    }
    
    // Validate the response based on question type
    let isValidResponse = true;
    let responseText = '';
    
    if (currentQuestion.type === 'options') {
      // Check if response is a valid option
      const optionIndex = parseInt(message.body) - 1;
      if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < currentQuestion.responseOptions.length) {
        // User responded with a number, use the corresponding option text
        responseText = currentQuestion.responseOptions[optionIndex];
      } else {
        // Check if the response matches any of the options
        const matchedOption = currentQuestion.responseOptions.find(
          opt => opt.toLowerCase() === message.body.toLowerCase()
        );
        
        if (matchedOption) {
          responseText = matchedOption;
        } else {
          isValidResponse = false;
          await whatsappClient.sendMessage(
            message.from, 
            'אנא בחר אחת מהאפשרויות המוצגות. השב במספר האפשרות או בטקסט מלא.'
          );
          await sendQuestion(message.from, currentQuestion);
        }
      }
    } else if (currentQuestion.type === 'image') {
      // For text messages when expecting an image
      isValidResponse = false;
      await whatsappClient.sendMessage(
        message.from, 
        'אנא שלח תמונה כתשובה לשאלה זו.'
      );
    } else {
      // For text questions, any response is valid
      responseText = message.body;
    }
    
    if (isValidResponse) {
      // Save the response
      surveyResponse.responses.push({
        questionId: currentQuestion._id,
        answer: responseText,
        answeredAt: new Date()
      });
      
      // Check for conditional questions based on this response
      const conditionalQuestions = await ConditionalQuestion.find({
        baseQuestionId: currentQuestion._id,
        active: true
      });
      
      let nextQuestion = null;
      let apiEndpointToCall = null;
      
      // Check if any conditional logic applies
      for (const conditional of conditionalQuestions) {
        let allConditionsMet = true;
        
        // Check all conditions
        for (const condition of conditional.conditions) {
          // Find the question and user's response for this condition
          const conditionQuestion = await Question.findById(condition.questionId);
          if (!conditionQuestion) continue;
          
          // Find user's response to this question
          const userResponse = surveyResponse.responses.find(
            r => r.questionId.toString() === condition.questionId.toString()
          );
          
          if (!userResponse) {
            allConditionsMet = false;
            break;
          }
          
          // Check if the condition is met
          const userAnswer = userResponse.answer;
          let conditionMet = false;
          
          switch (condition.operator) {
            case 'equals':
              conditionMet = userAnswer === condition.value;
              break;
            case 'notEquals':
              conditionMet = userAnswer !== condition.value;
              break;
            case 'contains':
              conditionMet = userAnswer.includes(condition.value);
              break;
            case 'startsWith':
              conditionMet = userAnswer.startsWith(condition.value);
              break;
            case 'endsWith':
              conditionMet = userAnswer.endsWith(condition.value);
              break;
            default:
              conditionMet = false;
          }
          
          if (!conditionMet) {
            allConditionsMet = false;
            break;
          }
        }
        
        // If all conditions are met, use this conditional's next question
        if (allConditionsMet) {
          nextQuestion = await Question.findById(conditional.nextQuestionId);
          
          // If there's an API endpoint to call, save it
          if (conditional.apiEndpointId) {
            apiEndpointToCall = conditional.apiEndpointId;
          }
          
          break;
        }
      }
      
      // If no conditional logic applied, get the next question in order
      if (!nextQuestion) {
        const questions = await Question.find({ active: true }).sort({ order: 1 });
        const currentIndex = questions.findIndex(q => q._id.toString() === currentQuestion._id.toString());
        nextQuestion = currentIndex < questions.length - 1 ? questions[currentIndex + 1] : null;
      }
      
      // If there's an API endpoint to call, make the call
      if (apiEndpointToCall) {
        try {
          // Prepare data for API call using survey responses
          const apiData = {
            phone: message.from,
            responses: surveyResponse.responses.map(r => ({
              question: questions.find(q => q._id.toString() === r.questionId.toString())?.text || 'Unknown',
              answer: r.answer
            }))
          };
          
          // Make the API call
          await makeApiCall(apiEndpointToCall, apiData, message.from);
          
          // Send acknowledgment to user
          await whatsappClient.sendMessage(
            message.from,
            'תודה על תשובתך. המידע נשלח לבדיקה במסלקה.'
          );
          
          // Save bot response
          let conversation = await Conversation.findOne({ phone: message.from });
          if (conversation) {
            conversation.messages.push({
              from: 'bot',
              content: 'תודה על תשובתך. המידע נשלח לבדיקה במסלקה.',
              timestamp: new Date()
            });
            await conversation.save();
            
            // Emit updated conversation to frontend
            io.emit('conversationUpdate', conversation);
          }
        } catch (error) {
          console.error('שגיאה בביצוע קריאת API:', error);
          
          // Notify user of error
          await whatsappClient.sendMessage(
            message.from,
            'אירעה שגיאה בביצוע בדיקת המסלקה. אנא נסה שוב מאוחר יותר.'
          );
        }
      }
      
      if (nextQuestion) {
        // Move to the next question
        surveyResponse.currentQuestionId = nextQuestion._id;
        await surveyResponse.save();
        
        // Send acknowledgment and the next question
        await whatsappClient.sendMessage(message.from, `תודה על תשובתך: "${responseText}"`);
        await sendQuestion(message.from, nextQuestion);
      } else {
        // Survey completed
        surveyResponse.isCompleted = true;
        surveyResponse.completedAt = new Date();
        await surveyResponse.save();
        
        await whatsappClient.sendMessage(
          message.from, 
          'תודה שהשלמת את הסקר! התשובות שלך נשמרו בהצלחה.'
        );
        
        // Ask if they want to verify their ID
        setTimeout(async () => {
          await whatsappClient.sendMessage(
            message.from, 
            'האם תרצה לאמת את תעודת הזהות שלך? השב "כן" או "אימות" כדי להתחיל את תהליך האימות.'
          );
        }, 2000);
      }
      
      // Update conversation with the response
      let conversation = await Conversation.findOne({ phone: message.from });
      if (conversation) {
        // Add bot's acknowledgment to the conversation
        conversation.messages.push({
          from: 'bot',
          content: `תודה על תשובתך: "${responseText}"`,
          timestamp: new Date()
        });
        
        await conversation.save();
        
        // Emit updated conversation to frontend
        io.emit('conversationUpdate', conversation);
      }
    }
  } catch (error) {
    console.error('שגיאה בעיבוד תשובת סקר:', error);
    await whatsappClient.sendMessage(message.from, 'אירעה שגיאה בעיבוד התשובה. אנא נסה שוב מאוחר יותר.');
  }
}

// Function to process media responses (images)
async function processMediaResponse(message, surveyResponse) {
  try {
    // Get the current question
    const currentQuestion = await Question.findById(surveyResponse.currentQuestionId);
    
    if (!currentQuestion) {
      await whatsappClient.sendMessage(message.from, 'אירעה שגיאה בעיבוד התשובה. אנא נסה שוב מאוחר יותר.');
      return;
    }
    
    // Check if the current question expects an image
    if (currentQuestion.type !== 'image') {
      await whatsappClient.sendMessage(
        message.from, 
        'שאלה זו אינה מצפה לתמונה. אנא השב בטקסט.'
      );
      await sendQuestion(message.from, currentQuestion);
      return;
    }
    
    // Download and save the media
    const media = await message.downloadMedia();
    
    if (!media) {
      await whatsappClient.sendMessage(message.from, 'לא ניתן היה להוריד את התמונה. אנא נסה שוב.');
      return;
    }
    
    // Generate a unique filename
    const fileExtension = media.mimetype.split('/')[1];
    const filename = `${Date.now()}-${message.from.replace(/\D/g, '')}.${fileExtension}`;
    const filePath = path.join(uploadsDir, filename);
    
    // Convert base64 to buffer and save to file
    const fileData = Buffer.from(media.data, 'base64');
    fs.writeFileSync(filePath, fileData);
    
    // Create a URL for the saved image
    const imageUrl = `/uploads/${filename}`;
    
    // Save the response with the image URL
    surveyResponse.responses.push({
      questionId: currentQuestion._id,
      answer: 'תמונה',
      imageUrl: imageUrl,
      answeredAt: new Date()
    });
    
    // Check for conditional questions based on this response
    const conditionalQuestions = await ConditionalQuestion.find({
      baseQuestionId: currentQuestion._id,
      active: true
    });
    
    let nextQuestion = null;
    let apiEndpointToCall = null;
    
    // Check if any conditional logic applies
    for (const conditional of conditionalQuestions) {
      // For image questions, we can only check if an image was provided
      // We can't check the content of the image
      
      // If there's a next question defined, use it
      nextQuestion = await Question.findById(conditional.nextQuestionId);
      
      // If there's an API endpoint to call, save it
      if (conditional.apiEndpointId) {
        apiEndpointToCall = conditional.apiEndpointId;
      }
      
      break;
    }
    
    // If no conditional logic applied, get the next question in order
    if (!nextQuestion) {
      const questions = await Question.find({ active: true }).sort({ order: 1 });
      const currentIndex = questions.findIndex(q => q._id.toString() === currentQuestion._id.toString());
      nextQuestion = currentIndex < questions.length - 1 ? questions[currentIndex + 1] : null;
    }
    
    // If there's an API endpoint to call, make the call
    if (apiEndpointToCall) {
      try {
        // Prepare data for API call
        const apiData = {
          phone: message.from,
          imageUrl: imageUrl,
          questionId: currentQuestion._id.toString(),
          questionText: currentQuestion.text
        };
        
        // Make the API call
        await makeApiCall(apiEndpointToCall, apiData, message.from);
      } catch (error) {
        console.error('שגיאה בביצוע קריאת API:', error);
      }
    }
    
    if (nextQuestion) {
      // Move to the next question
      surveyResponse.currentQuestionId = nextQuestion._id;
      await surveyResponse.save();
      
      // Send acknowledgment and the next question
      await whatsappClient.sendMessage(message.from, 'תודה על שליחת התמונה!');
      await sendQuestion(message.from, nextQuestion);
    } else {
      // Survey completed
      surveyResponse.isCompleted = true;
      surveyResponse.completedAt = new Date();
      await surveyResponse.save();
      
      await whatsappClient.sendMessage(
        message.from, 
        'תודה שהשלמת את הסקר! התשובות שלך נשמרו בהצלחה.'
      );
      
      // Ask if they want to verify their ID
      setTimeout(async () => {
        await whatsappClient.sendMessage(
          message.from, 
          'האם תרצה לאמת את תעודת הזהות שלך? השב "כן" או "אימות" כדי להתחיל את תהליך האימות.'
        );
      }, 2000);
    }
    
    // Update conversation with the image
    let conversation = await Conversation.findOne({ phone: message.from });
    if (conversation) {
      // Add user's image to the conversation
      conversation.messages.push({
        from: 'user',
        content: 'תמונה',
        imageUrl: imageUrl,
        timestamp: new Date()
      });
      
      // Add bot's acknowledgment to the conversation
      conversation.messages.push({
        from: 'bot',
        content: 'תודה על שליחת התמונה!',
        timestamp: new Date()
      });
      
      await conversation.save();
      
      // Emit updated conversation to frontend
      io.emit('conversationUpdate', conversation);
    }
  } catch (error) {
    console.error('שגיאה בעיבוד תשובת מדיה:', error);
    await whatsappClient.sendMessage(message.from, 'אירעה שגיאה בעיבוד התמונה. אנא נסה שוב מאוחר יותר.');
  }
}

// Function to check pending API calls and update their status
async function checkPendingApiCalls() {
  try {
    const pendingCalls = await ApiCall.find({ status: 'pending' });
    
    for (const call of pendingCalls) {
      // Check if call has been pending for more than 5 minutes
      const pendingTime = new Date() - new Date(call.createdAt);
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if (pendingTime > fiveMinutesInMs) {
        console.log(`קריאת API ${call._id} ממתינ ה יותר מ-5 דקות, מנסה שוב...`);
        
        // For ID verification calls, retry the verification
        if (call.type === 'id-verification' && call.idNumber && call.phone) {
          // Find the verification record
          const verification = await IdVerification.findOne({ 
            phone: call.phone,
            idNumber: call.idNumber,
            status: 'pending'
          });
          
          if (verification) {
            // Retry the verification
            verifyIdWithExternalApi(call.idNumber, call._id, verification._id, call.phone);
          } else {
            // Mark as failed if verification record not found
            call.status = 'failed';
            call.errorMessage = 'לא נמצאה רשומת אימות מתאימה';
            call.completedAt = new Date();
            await call.save();
          }
        } else {
          // Mark as failed for other types or missing data
          call.status = 'failed';
          call.errorMessage = 'קריאה נכשלה עקב זמן המתנה ארוך';
          call.completedAt = new Date();
          await call.save();
        }
      }
    }
  } catch (error) {
    console.error('שגיאה בבדיקת קריאות API ממתינות:', error);
  }
}

// Set up periodic check for pending API calls
setInterval(checkPendingApiCalls, 60000); // Check every minute

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('לקוח התחבר');
  
  // Send current bot status
  socket.emit('botStatus', { active: botActive });
  
  // Send QR code if available
  if (qrCodeData) {
    socket.emit('qrCode', qrCodeData);
  }
  
  // Start bot
  socket.on('startBot', () => {
    console.log('התקבלה בקשה להפעלת בוט');
    
    // אם הבוט כבר פעיל, שלח את הסטטוס הנוכחי
    if (botActive && whatsappClient) {
      console.log('הבוט כבר פעיל, שולח סטטוס נוכחי');
      socket.emit('botStatus', { active: botActive });
      return;
    }
    
    // אם יש לקוח קיים אבל הוא לא פעיל, נסה להפעיל אותו מחדש
    if (whatsappClient && !botActive) {
      try {
        whatsappClient.destroy();
      } catch (error) {
        console.error('שגיאה בסגירת לקוח WhatsApp קיים:', error);
      }
      whatsappClient = null;
    }
    
    console.log('מפעיל בוט WhatsApp');
    initializeWhatsAppClient();
  });
  
  // Stop bot
  socket.on('stopBot', async () => {
    if (whatsappClient) {
      console.log('מפסיק בוט WhatsApp');
      try {
        await whatsappClient.destroy();
        whatsappClient = null;
        botActive = false;
        qrCodeData = null;
        io.emit('botStatus', { active: botActive });
      } catch (error) {
        console.error('שגיאה בהפסקת בוט WhatsApp:', error);
        io.emit('botStatus', { 
          active: false, 
          error: 'שגיאה בהפסקת הבוט: ' + error.message 
        });
      }
    }
  });
  
  // Retry failed API call
  socket.on('retryApiCall', async (apiCallId) => {
    try {
      const apiCall = await ApiCall.findById(apiCallId);
      if (!apiCall) {
        socket.emit('error', { message: 'קריאת API לא נמצאה' });
        return;
      }
      
      if (apiCall.type === 'id-verification' && apiCall.idNumber && apiCall.phone) {
        // Reset API call status
        apiCall.status = 'pending';
        apiCall.errorMessage = null;
        await apiCall.save();
        
        // Find or create verification record
        let verification = await IdVerification.findOne({
          phone: apiCall.phone,
          idNumber: apiCall.idNumber
        });
        
        if (!verification) {
          verification = new IdVerification({
            phone: apiCall.phone,
            idNumber: apiCall.idNumber,
            status: 'pending',
            verifiedAt: new Date()
          });
          await verification.save();
        } else {
          verification.status = 'pending';
          await verification.save();
        }
        
        // Retry verification
        verifyIdWithExternalApi(apiCall.idNumber, apiCall._id, verification._id, apiCall.phone);
        
        socket.emit('success', { message: 'קריאת API נשלחה מחדש' });
      } else {
        socket.emit('error', { message: 'לא ניתן לשלוח מחדש קריאה מסוג זה' });
      }
    } catch (error) {
      console.error('שגיאה בשליחה מחדש של קריאת API:', error);
      socket.emit('error', { message: 'שגיאה בשליחה מחדש של קריאת API' });
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('לקוח התנתק');
  });
});

// API Routes

// Get all questions
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new question
app.post('/api/questions', async (req, res) => {
  try {
    const { text, responseOptions, type, order, isRequired } = req.body;
    
    // Find the highest order value
    const highestOrder = await Question.findOne().sort({ order: -1 });
    const newOrder = order || (highestOrder ? highestOrder.order + 1 : 0);
    
    const question = new Question({ 
      text, 
      responseOptions, 
      type: type || 'text',
      order: newOrder,
      isRequired: isRequired || false
    });
    
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a question
app.put('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, responseOptions, active, type, order, isRequired } = req.body;
    const question = await Question.findByIdAndUpdate(
      id,
      { text, responseOptions, active, type, order, isRequired },
      { new: true }
    );
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Question.findByIdAndDelete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder questions
app.post('/api/questions/reorder', async (req, res) => {
  try {
    const { questionIds } = req.body;
    
    // Update the order of each question
    for (let i = 0; i < questionIds.length; i++) {
      await Question.findByIdAndUpdate(questionIds[i], { order: i });
    }
    
    const questions = await Question.find().sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all API calls
app.get('/api/api-calls', async (req, res) => {
  try {
    const apiCalls = await ApiCall.find().sort({ createdAt: -1 });
    res.json(apiCalls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending API calls
app.get('/api/api-calls/pending', async (req, res) => {
  try {
    const pendingCalls = await ApiCall.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(pendingCalls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry a failed API call
app.post('/api/api-calls/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const apiCall = await ApiCall.findById(id);
    
    if (!apiCall) {
      return res.status(404).json({ error: 'קריאת API לא נמצאה' });
    }
    
    if (apiCall.status !== 'failed') {
      return res.status(400).json({ error: 'ניתן לשלוח מחדש רק קריאות שנכשלו' });
    }
    
    if (apiCall.type === 'id-verification' && apiCall.idNumber && apiCall.phone) {
      // Reset API call status
      apiCall.status = 'pending';
      apiCall.errorMessage = null;
      await apiCall.save();
      
      // Find or create verification record
      let verification = await IdVerification.findOne({
        phone: apiCall.phone,
        idNumber: apiCall.idNumber
      });
      
      if (!verification) {
        verification = new IdVerification({
          phone: apiCall.phone,
          idNumber: apiCall.idNumber,
          status: 'pending',
          verifiedAt: new Date()
        });
        await verification.save();
      } else {
        verification.status = 'pending';
        await verification.save();
      }
      
      // Retry verification (async)
      verifyIdWithExternalApi(apiCall.idNumber, apiCall._id, verification._id, apiCall.phone);
      
      res.json({ message: 'קריאת API נשלחה מחדש', apiCall });
    } else {
      res.status(400).json({ error: 'לא ניתן לשלוח מחדש קריאה מסוג זה' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all API endpoints
app.get('/api/api-endpoints', async (req, res) => {
  try {
    const endpoints = await ApiEndpoint.find().sort({ createdAt: -1 });
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new API endpoint
app.post('/api/api-endpoints', async (req, res) => {
  try {
    const { name, url, description, headers, active } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'שם וכתובת URL הם שדות חובה' });
    }
    
    const endpoint = new ApiEndpoint({
      name,
      url,
      description,
      headers: headers || { 'Content-Type': 'application/json' },
      active: active !== undefined ? active : true
    });
    
    await endpoint.save();
    res.status(201).json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an API endpoint
app.put('/api/api-endpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, headers, active } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'שם וכתובת URL הם שדות חובה' });
    }
    
    const endpoint = await ApiEndpoint.findByIdAndUpdate(
      id,
      { name, url, description, headers, active },
      { new: true }
    );
    
    if (!endpoint) {
      return res.status(404).json({ error: 'נקודת קצה API לא נמצאה' });
    }
    
    res.json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an API endpoint
app.delete('/api/api-endpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ApiEndpoint.findByIdAndDelete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all conditional questions
app.get('/api/conditional-questions', async (req, res) => {
  try {
    const conditionalQuestions = await ConditionalQuestion.find()
      .populate('baseQuestionId')
      .populate('nextQuestionId')
      .populate('apiEndpointId')
      .sort({ createdAt: -1 });
    res.json(conditionalQuestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new conditional question
app.post('/api/conditional-questions', async (req, res) => {
  try {
    const { baseQuestionId, conditions, nextQuestionId, apiEndpointId, active } = req.body;
    
    if (!baseQuestionId || !nextQuestionId) {
      return res.status(400).json({ error: 'שאלת בסיס ושאלה הבאה הם שדות חובה' });
    }
    
    // Validate that questions exist
    const baseQuestion = await Question.findById(baseQuestionId);
    const nextQuestion = await Question.findById(nextQuestionId);
    
    if (!baseQuestion || !nextQuestion) {
      return res.status(400).json({ error: 'אחת השאלות שצוינו אינה קיימת' });
    }
    
    // Validate conditions
    for (const condition of conditions) {
      if (!condition.questionId) {
        return res.status(400).json({ error: 'כל תנאי חייב לכלול שאלה' });
      }
      
      const conditionQuestion = await Question.findById(condition.questionId);
      if (!conditionQuestion) {
        return res.status(400).json({ error: `שאלה ${condition.questionId} אינה קיימת` });
      }
    }
    
    // Validate API endpoint if provided
    if (apiEndpointId) {
      const apiEndpoint = await ApiEndpoint.findById(apiEndpointId);
      if (!apiEndpoint) {
        return res.status(400).json({ error: 'נקודת קצה API שצוינה אינה קיימת' });
      }
    }
    
    const conditionalQuestion = new ConditionalQuestion({
      baseQuestionId,
      conditions,
      nextQuestionId,
      apiEndpointId,
      active: active !== undefined ? active : true
    });
    
    await conditionalQuestion.save();
    
    // Populate references for response
    await conditionalQuestion.populate('baseQuestionId');
    await conditionalQuestion.populate('nextQuestionId');
    if (apiEndpointId) {
      await conditionalQuestion.populate('apiEndpointId');
    }
    
    res.status(201).json(conditionalQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a conditional question
app.put('/api/conditional-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { baseQuestionId, conditions, nextQuestionId, apiEndpointId, active } = req.body;
    
    if (!baseQuestionId || !nextQuestionId) {
      return res.status(400).json({ error: 'שאלת בסיס ושאלה הבאה הם שדות חובה' });
    }
    
    // Validate that questions exist
    const baseQuestion = await Question.findById(baseQuestionId);
    const nextQuestion = await Question.findById(nextQuestionId);
    
    if (!baseQuestion || !nextQuestion) {
      return res.status(400).json({ error: 'אחת השאלות שצוינו אינה קיימת' });
    }
    
    // Validate conditions
    for (const condition of conditions) {
      if (!condition.questionId) {
        return res.status(400).json({ error: 'כל תנאי חייב לכלול שאלה' });
      }
      
      const conditionQuestion = await Question.findById(condition.questionId);
      if (!conditionQuestion) {
        return res.status(400).json({ error: `שאלה ${condition.questionId} אינה קיימת` });
      }
    }
    
    // Validate API endpoint if provided
    if (apiEndpointId) {
      const apiEndpoint = await ApiEndpoint.findById(apiEndpointId);
      if (!apiEndpoint) {
        return res.status(400).json({ error: 'נקודת קצה API שצוינה אינה קיימת' });
      }
    }
    
    const conditionalQuestion = await ConditionalQuestion.findByIdAndUpdate(
      id,
      { baseQuestionId, conditions, nextQuestionId, apiEndpointId, active },
      { new: true }
    );
    
    if (!conditionalQuestion) {
      return res.status(404).json({ error: 'שאלה מותנית לא נמצאה' });
    }
    
    // Populate references for response
    await conditionalQuestion.populate('baseQuestionId');
    await conditionalQuestion.populate('nextQuestionId');
    if (apiEndpointId) {
      await conditionalQuestion.populate('apiEndpointId');
    }
    
    res.json(conditionalQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a conditional question
app.delete('/api/conditional-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ConditionalQuestion.findByIdAndDelete(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all survey responses
app.get('/api/survey-responses', async (req, res) => {
  try {
    const responses = await SurveyResponse.find()
      .populate('currentQuestionId')
      .populate('responses.questionId')
      .sort({ startedAt: -1 });
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific survey response
app.get('/api/survey-responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await SurveyResponse.findById(id)
      .populate('currentQuestionId')
      .populate('responses.questionId');
    
    if (!response) {
      return res.status(404).json({ error: 'תשובת הסקר לא נמצאה' });
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific conversation
app.get('/api/conversations/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const conversation = await Conversation.findOne({ phone });
    if (!conversation) {
      return res.status(404).json({ error: 'השיחה לא נמצאה' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all ID verifications
app.get('/api/verifications', async (req, res) => {
  try {
    const verifications = await IdVerification.find().sort({ verifiedAt: -1 });
    res.json(verifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', botActive });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`השרת פועל בפורט ${PORT}`);
});