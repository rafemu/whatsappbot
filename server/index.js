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

// Import routes
import botRouter from './routes/bot.js';
import conversationsRouter from './routes/conversations.js';
import questionsRouter from './routes/questions.js';
import verificationsRouter from './routes/verifications.js';
import surveyResponsesRouter from './routes/survey-responses.js';
import endpointsRouter from './routes/endpoints.js';
import clearingHouseChecksRouter from './routes/clearing-house-checks.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
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

// Initialize Socket.IO with cleanup on disconnect
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('Client connected');

  // Handle startBot event
  socket.on('startBot', async () => {
    console.log('Received startBot event');
    try {
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

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Clean up any listeners specific to this socket
    socket.removeAllListeners();
  });
});

// Store io instance in app for access in routes
app.set('io', io);

// Connect to MongoDB
console.log('מתחבר למסד הנתונים MongoDB:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('מחובר למסד הנתונים MongoDB'))
  .catch(err => console.error('שגיאת התחברות ל-MongoDB:', err));

// Use routes
app.use('/api/bot', botRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/verifications', verificationsRouter);
app.use('/api/survey-responses', surveyResponsesRouter);
app.use('/api/endpoints', endpointsRouter);
app.use('/api/clearing-house-checks', clearingHouseChecksRouter);

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

// Cleanup function for server shutdown
const cleanup = async () => {
  console.log('מנקה משאבים לפני כיבוי השרת...');
  
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

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`השרת פועל בפורט ${PORT}`);
});