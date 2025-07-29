// backend/src/routes/dispatchInputs.js - Simple version with memory storage
const express = require('express');
const router = express.Router();

// In-memory storage (will reset when server restarts)
let dispatchInputsStore = [];

// Test route to make sure it's working
router.get('/test', (req, res) => {
  res.json({ message: 'Dispatch inputs route is working!' });
});

// GET /api/dispatch-inputs - Get latest data
router.get('/', (req, res) => {
  const { latest } = req.query;
  
  if (latest === 'true') {
    // Return the most recent entry
    const latestEntry = dispatchInputsStore.length > 0 ? 
      dispatchInputsStore[dispatchInputsStore.length - 1] : null;
    res.json(latestEntry);
  } else {
    // Return all entries
    res.json({ 
      dispatchInputs: dispatchInputsStore,
      total: dispatchInputsStore.length 
    });
  }
});

// POST /api/dispatch-inputs - Receive data from frontend
router.post('/', (req, res) => {
  const { origin, destination, miles, targetProfit, date } = req.body;
  
  const newEntry = {
    id: dispatchInputsStore.length + 1,
    origin: origin || '',
    destination: destination || '',
    miles: parseInt(miles) || 0,
    targetProfit: parseInt(targetProfit) || 0,
    date: date || '',
    timestamp: new Date().toISOString(),
    dispatchUser: 'dispatch'
  };
  
  // Store in memory
  dispatchInputsStore.push(newEntry);
  
  console.log('Stored dispatch inputs:', newEntry);
  console.log('Total entries:', dispatchInputsStore.length);
  
  res.json({ 
    success: true,
    message: 'Dispatch inputs received successfully',
    data: newEntry
  });
});

// GET /api/dispatch-inputs/status - Status check
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    totalEntries: dispatchInputsStore.length,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;