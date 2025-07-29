// backend/src/routes/dispatchInputs.js - Simple version
const express = require('express');
const router = express.Router();

// Test route to make sure it's working
router.get('/test', (req, res) => {
  res.json({ message: 'Dispatch inputs route is working!' });
});

// GET /api/dispatch-inputs - Get latest data
router.get('/', (req, res) => {
  res.json({ 
    message: 'Dispatch inputs endpoint working',
    dispatchInputs: [],
    total: 0 
  });
});

// POST /api/dispatch-inputs - Receive data from frontend
router.post('/', (req, res) => {
  const { origin, destination, miles, targetProfit, date } = req.body;
  
  console.log('Received dispatch inputs:', {
    origin,
    destination, 
    miles,
    targetProfit,
    date
  });
  
  // For now, just return success without database
  res.json({ 
    success: true,
    message: 'Dispatch inputs received successfully',
    data: {
      origin,
      destination,
      miles,
      targetProfit,
      date,
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/dispatch-inputs/status - Status check
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    totalEntries: 0,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;