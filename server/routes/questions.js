import express from 'express';
import Question from '../models/Question.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all questions
router.get('/', async (req, res) => {
  try {
    const questions = await Question.find().sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new question
router.post('/', async (req, res) => {
  try {
    const { text, responseOptions, types, order, isRequired, conditions, apiEndpointId, apiMessages } = req.body;

    // Find the highest order value
    const highestOrder = await Question.findOne().sort({ order: -1 });
    const newOrder = order || (highestOrder ? highestOrder.order + 1 : 0);

    // Validate apiEndpointId if type includes 'api'
    let formattedApiEndpointId = null;
    if (types?.includes('api')) {
      if (!apiEndpointId) {
        return res.status(400).json({ error: 'API endpoint is required when type includes "api"' });
      }
      if (!mongoose.Types.ObjectId.isValid(apiEndpointId)) {
        return res.status(400).json({ error: 'Invalid API endpoint ID' });
      }
      formattedApiEndpointId = new mongoose.Types.ObjectId(apiEndpointId);
    }

    const question = new Question({ 
      text, 
      responseOptions, 
      types: types || ['text'],
      order: newOrder,
      isRequired: isRequired || false,
      conditions: conditions || [],
      apiEndpointId: formattedApiEndpointId,  // ✅ כעת תמיד זה יהיה ObjectId או null
      apiMessages
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(500).json({ error: error.message });
  }
});

// router.post('/', async (req, res) => {
//   try {
//     const { text, responseOptions, types, order, isRequired, conditions, apiEndpointId, apiMessages } = req.body;
//     console.log(
//       'postinng new q',req.body
//     )
//     // Find the highest order value
//     const highestOrder = await Question.findOne().sort({ order: -1 });
//     const newOrder = order || (highestOrder ? highestOrder.order + 1 : 0);
    
//     // Validate apiEndpointId if type includes 'api'
//     if (types?.includes('api')) {
//       if (!apiEndpointId) {
//         return res.status(400).json({ error: 'API endpoint is required when type includes "api"' });
//       }
//       // Validate that apiEndpointId is a valid ObjectId
//       if (!mongoose.Types.ObjectId.isValid(apiEndpointId)) {
//         return res.status(400).json({ error: 'Invalid API endpoint ID' });
//       }
//     }
    
//     const question = new Question({ 
//       text, 
//       responseOptions, 
//       types: types || ['text'],
//       order: newOrder,
//       isRequired: isRequired || false,
//       conditions: conditions || [],
//       apiEndpointId: types?.includes('api') ? apiEndpointId :  null,
//       apiMessages
//     });
    
//     await question.save();
//     res.status(201).json(question);
//   } catch (error) {
//     console.log(error)
//     res.status(500).json({ error: error.message });
//   }
// });

// Update a question
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, responseOptions, active, types, order, isRequired, conditions, apiEndpointId, apiMessages } = req.body;
    
    // Validate apiEndpointId if type includes 'api'
    if (types?.includes('api')) {
      if (!apiEndpointId) {
        return res.status(400).json({ error: 'API endpoint is required when type includes "api"' });
      }
      // Validate that apiEndpointId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(apiEndpointId)) {
        return res.status(400).json({ error: 'Invalid API endpoint ID' });
      }
    }
    
    const question = await Question.findByIdAndUpdate(
      id,
      { 
        text, 
        responseOptions, 
        active, 
        types, 
        order, 
        isRequired, 
        conditions,
        apiEndpointId: types?.includes('api') ? apiEndpointId : null,
        apiMessages
      },
      { new: true, runValidators: true }
    );
    
    if (!question) {
      return res.status(404).json({ error: 'השאלה לא נמצאה' });
    }
    
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a question
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findByIdAndDelete(id);
    
    if (!question) {
      return res.status(404).json({ error: 'השאלה לא נמצאה' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update question order
router.put('/:id/order', async (req, res) => {
  try {
    const { id } = req.params;
    const { newOrder } = req.body;
    
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'השאלה לא נמצאה' });
    }
    
    // Update orders for all affected questions
    await Question.updateMany(
      { order: { $gte: newOrder, $lt: question.order } },
      { $inc: { order: 1 } }
    );
    
    question.order = newOrder;
    await question.save();
    
    const questions = await Question.find().sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;