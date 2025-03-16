import express from 'express';
import IdVerification from '../models/IdVerification.js';

const router = express.Router();

// Get all ID verifications
router.get('/', async (req, res) => {
  try {
    const verifications = await IdVerification.find().sort({ verifiedAt: -1 });
    res.json(verifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get verification by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await IdVerification.findById(id);
    
    if (!verification) {
      return res.status(404).json({ error: 'האימות לא נמצא' });
    }
    
    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;