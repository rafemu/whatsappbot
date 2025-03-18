import express from 'express';
import BotStatus from '../models/BotStatus.js';
import BotConfig from '../models/BotConfig.js';
import { 
  initializeWhatsAppClient, 
  destroyWhatsAppClient, 
  getWhatsAppClient,
  getQRCode 
} from '../services/whatsapp.js';
import { configManager } from '../services/configManager.js';

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

// Get bot configuration
router.get('/config', async (req, res) => {
  try {
    const config = await configManager.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bot configuration
router.put('/config', async (req, res) => {
  try {
    const config = await configManager.updateConfig(req.body);
    res.json(config);
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

    // Validate session limit
    const canStartSession = await configManager.validateSession();
    if (!canStartSession) {
      return res.status(400).json({ 
        error: 'הגעת למספר המקסימלי של סשנים פעילים' 
      });
    }

    // Initialize WhatsApp client
    await initializeWhatsAppClient(req.app.get('io'));
    res.json({ message: 'מתחיל את הבוט...' });
  } catch (error) {
    // Get Socket.IO instance
    const io = req.app.get('io');
    
    // Emit error status if Socket.IO is available
    if (io) {
      io.emit('botStatus', {
        active: false,
        status: 'error',
        error: error.message
      });
    }

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
    
    // Emit status update if Socket.IO is available
    if (io) {
      io.emit('botStatus', { 
        active: false,
        status: 'stopped'
      });
    }

    res.json({ message: 'הבוט כובה בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;