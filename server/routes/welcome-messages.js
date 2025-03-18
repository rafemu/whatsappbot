import express from 'express';
import WelcomeMessage from '../models/WelcomeMessage.js';

const router = express.Router();

// Get all welcome messages
router.get('/', async (req, res) => {
  try {
    const messages = await WelcomeMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new welcome message
router.post('/', async (req, res) => {
  try {
    const { text, conditions } = req.body;
    
    if (!text?.trim()) {
      return res.status(400).json({ error: 'נדרש טקסט להודעת הפתיחה' });
    }
    
    const message = new WelcomeMessage({ text, conditions });
    await message.save();
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update welcome message
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, active, conditions } = req.body;
    
    if (!text?.trim()) {
      return res.status(400).json({ error: 'נדרש טקסט להודעת הפתיחה' });
    }
    
    const message = await WelcomeMessage.findByIdAndUpdate(
      id,
      { text, active, conditions },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ error: 'הודעת הפתיחה לא נמצאה' });
    }
    
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete welcome message
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await WelcomeMessage.findByIdAndDelete(id);
    
    if (!message) {
      return res.status(404).json({ error: 'הודעת הפתיחה לא נמצאה' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;