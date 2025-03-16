import express from 'express';
import ClearingHouseCheck from '../models/ClearingHouseCheck.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import axios from 'axios';

const router = express.Router();

// Get all checks
router.get('/', async (req, res) => {
  try {
    const checks = await ClearingHouseCheck.find()
      .populate('endpointId')
      .sort({ createdAt: -1 });
    res.json(checks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new check
router.post('/', async (req, res) => {
  try {
    const { phone, endpointId, requestData } = req.body;
    
    // Validate endpoint exists and is active
    const endpoint = await ApiEndpoint.findById(endpointId);
    if (!endpoint) {
      return res.status(404).json({ error: 'כתובת ה-API לא נמצאה' });
    }
    if (!endpoint.active) {
      return res.status(400).json({ error: 'כתובת ה-API אינה פעילה' });
    }
    
    // Create check record
    const check = new ClearingHouseCheck({
      phone,
      endpointId,
      requestData,
      status: 'pending'
    });
    
    await check.save();
    
    // Execute API call asynchronously
    executeApiCheck(check._id).catch(console.error);
    
    res.status(201).json(check);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh check status
router.get('/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await ClearingHouseCheck.findById(id).populate('endpointId');
    
    if (!check) {
      return res.status(404).json({ error: 'הבדיקה לא נמצאה' });
    }
    
    if (check.status === 'pending') {
      // Re-execute API call
      await executeApiCheck(check._id);
    }
    
    // Get updated check data
    const updatedCheck = await ClearingHouseCheck.findById(id).populate('endpointId');
    res.json(updatedCheck);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to execute API check
async function executeApiCheck(checkId) {
  try {
    const check = await ClearingHouseCheck.findById(checkId).populate('endpointId');
    if (!check || check.status !== 'pending') return;
    
    const response = await axios({
      method: 'post',
      url: check.endpointId.url,
      data: check.requestData,
      timeout: 30000 // 30 seconds timeout
    });
    
    check.responseData = response.data;
    check.status = 'success';
    check.completedAt = new Date();
    await check.save();
  } catch (error) {
    const check = await ClearingHouseCheck.findById(checkId);
    if (!check) return;
    
    check.status = 'failed';
    check.errorMessage = error.message;
    check.completedAt = new Date();
    if (error.response) {
      check.responseData = error.response.data;
    }
    await check.save();
  }
}

export default router;