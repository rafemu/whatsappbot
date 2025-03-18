import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { initializeWhatsAppClient } from './services/whatsapp.js';
import { configManager } from './services/configManager.js';
import { cronManager } from './services/cronManager.js';
import { auth, adminOnly } from './middleware/auth.js';

// Import routes
import botRouter from './routes/bot.js';
import conversationsRouter from './routes/conversations.js';
import questionsRouter from './routes/questions.js';
import verificationsRouter from './routes/verifications.js';
import surveyResponsesRouter from './routes/survey-responses.js';
import endpointsRouter from './routes/endpoints.js';
import clearingHouseChecksRouter from './routes/clearing-house-checks.js';
import welcomeMessagesRouter from './routes/welcome-messages.js';
import authRouter from './routes/auth.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Configure CORS with specific options
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your frontend URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Create HTTP server
const server = createServer(app);

// Increase EventEmitter default max listeners
EventEmitter.defaultMaxListeners = 15;

// Configure Socket.IO with specific options
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  allowEIO3: true
});

// Socket.IO error handling middleware
io.engine.on("connection_error", (err) => {
  console.log('Socket.IO connection error:', err);
});

// Store io instance in app for access in routes
app.set('io', io);

// Connect to MongoDB with retry logic
const connectWithRetry = async (retries = 5, interval = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${i + 1}/${retries})...`);
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 2000
      });
      console.log('Successfully connected to MongoDB');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${interval/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
  return false;
};

// Initialize application
const initializeApp = async () => {
  try {
    // Connect to MongoDB first
    const connected = await connectWithRetry();
    if (!connected) {
      throw new Error('Failed to connect to MongoDB after multiple attempts');
    }

    // Initialize config manager after MongoDB connection is established
    await configManager.initialize();
    console.log('Configuration manager initialized successfully');

    // Initialize cron jobs
    cronManager.initialize();
    console.log('Cron jobs initialized successfully');

    // Handle socket connections with improved error handling
    io.on('connection', (socket) => {
      console.log('Client connected');

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socket.on('startBot', async () => {
        console.log('Received startBot event');
        try {
          const canStartSession = await configManager.validateSession();
          if (!canStartSession) {
            socket.emit('botStatus', {
              active: false,
              status: 'error',
              error: 'הגעת למספר המקסימלי של סשנים פעילים'
            });
            return;
          }

          await initializeWhatsAppClient(io);
        } catch (error) {
          console.error('Error starting bot:', error);
          socket.emit('botStatus', {
            active: false,
            status: 'error',
            error: error.message
          });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', reason);
        socket.removeAllListeners();
      });
    });

    // Use routes
    app.use('/api/auth', authRouter);
    app.use('/api/bot', auth, botRouter);
    app.use('/api/conversations', auth, conversationsRouter);
    app.use('/api/questions', auth, questionsRouter);
    app.use('/api/verifications', auth, verificationsRouter);
    app.use('/api/survey-responses', auth, surveyResponsesRouter);
    app.use('/api/endpoints', auth, endpointsRouter);
    app.use('/api/clearing-house-checks', auth, clearingHouseChecksRouter);
    app.use('/api/welcome-messages', auth, welcomeMessagesRouter);

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      const status = {
        server: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      };
      res.json(status);
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({ 
        error: 'שגיאת שרת פנימית',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // Start server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`השרת פועל בפורט ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Cleanup function for server shutdown
const cleanup = async () => {
  console.log('מנקה משאבים לפני כיבוי השרת...');
  
  // Stop all cron jobs
  cronManager.stopAll();
  
  // Close all socket connections
  io.close();
  
  // Close MongoDB connection
  await mongoose.connection.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('השרת נסגר בהצלחה');
    process.exit(0);
  });
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the application
initializeApp().catch(error => {
  console.error('Application startup failed:', error);
  process.exit(1);
});