import express from 'express';
import BotStatus from '../models/BotStatus.js';
import { 
  initializeWhatsAppClient, 
  destroyWhatsAppClient, 
  getWhatsAppClient,
  getQRCode 
} from '../services/whatsapp.js';

const router = express.Router();

// Get bot status
router.get('/status', async (req, res) => {
  try {
    let status = await BotStatus.findOne();
    if (!status) {
      status = await BotStatus.create({ isActive: false });
    }
    
    // Include QR code in response if available
    const qrCode = getQRCode();
    res.json({
      ...status.toObject(),
      qrCode
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start bot
router.post('/start', async (req, res) => {
  try {
    let status = await BotStatus.findOne();
    if (!status) {
      status = await BotStatus.create({ isActive: false });
    }

    if (status.isActive) {
      return res.status(400).json({ error: 'הבוט כבר פעיל' });
    }

    // Get Socket.IO instance
    const io = req.app.get('io');
    
    // Emit status update
    io.emit('botStatus', {
      active: false,
      status: 'initializing'
    });

    // Initialize WhatsApp client
    await initializeWhatsAppClient(io);
    res.json({ message: 'מתחיל את הבוט...' });
  } catch (error) {
    // Get Socket.IO instance
    const io = req.app.get('io');
    
    // Emit error status
    io.emit('botStatus', {
      active: false,
      status: 'error',
      error: error.message
    });

    res.status(500).json({ error: error.message });
  }
});

// Stop bot
router.post('/stop', async (req, res) => {
  try {
    let status = await BotStatus.findOne();
    if (!status) {
      status = await BotStatus.create({ isActive: false });
    }

    if (!status.isActive) {
      return res.status(400).json({ error: 'הבוט כבר כבוי' });
    }

    await destroyWhatsAppClient();

    status.isActive = false;
    status.connectedPhone = null;
    status.lastDisconnection = new Date();
    await status.save();

    // Get Socket.IO instance
    const io = req.app.get('io');
    
    // Emit status update
    io.emit('botStatus', { 
      active: false,
      status: 'stopped'
    });

    res.json({ message: 'הבוט כובה בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;