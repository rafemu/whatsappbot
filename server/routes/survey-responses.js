import express from 'express';
import SurveyResponse from '../models/SurveyResponse.js';

const router = express.Router();

// Get all survey responses
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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

export default router;