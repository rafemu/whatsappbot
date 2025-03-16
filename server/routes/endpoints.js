import express from 'express';
import ApiEndpoint from '../models/ApiEndpoint.js';

const router = express.Router();

// Get all API endpoints
router.get('/', async (req, res) => {
  try {
    const endpoints = await ApiEndpoint.find().sort({ createdAt: -1 });
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new API endpoint
router.post('/', async (req, res) => {
  try {
    const { name, url, description, active } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'שם וכתובת URL הם שדות חובה' });
    }
    
    const endpoint = new ApiEndpoint({ 
      name, 
      url, 
      description, 
      active: active !== undefined ? active : true
    });
    
    await endpoint.save();
    res.status(201).json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an API endpoint
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, active } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'שם וכתובת URL הם שדות חובה' });
    }
    
    const endpoint = await ApiEndpoint.findByIdAndUpdate(
      id,
      { name, url, description, active },
      { new: true }
    );
    
    if (!endpoint) {
      return res.status(404).json({ error: 'כתובת ה-API לא נמצאה' });
    }
    
    res.json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an API endpoint
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const endpoint = await ApiEndpoint.findByIdAndDelete(id);
    
    if (!endpoint) {
      return res.status(404).json({ error: 'כתובת ה-API לא נמצאה' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;