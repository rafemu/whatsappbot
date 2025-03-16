import express from 'express';
import Conversation from '../models/Conversation.js';

const router = express.Router();

// Get all conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific conversation
router.get('/:phone', async (req, res) => {
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

export default router;