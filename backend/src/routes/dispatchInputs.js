// backend/src/routes/dispatchInputs.js - Create this new file
const express = require('express');
const { database } = require('../utils/database');
const { logger } = require('../utils/logger');
const router = express.Router();

// Initialize dispatch_inputs table
// At the top of your dispatchInputs.js, change the initializeDispatchInputsTable function:
const initializeDispatchInputsTable = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS dispatch_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT,
      destination TEXT,
      miles INTEGER,
      target_profit INTEGER,
      dispatch_user TEXT DEFAULT 'dispatch',
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  // Make it safer with error handling
  if (database) {
    database.run(createTableQuery, (err) => {
      if (err) {
        logger.error('Error creating dispatch_inputs table:', err);
      } else {
        logger.info('Dispatch inputs table ready');
      }
    });
  }
};

// And add this back at the bottom:
setTimeout(() => {
  initializeDispatchInputsTable();
}, 5000); // Wait 5 seconds for database to be ready
// Initialize table on module load
// initializeDispatchInputsTable();

// POST /api/dispatch-inputs - Receive data from frontend
router.post('/', (req, res) => {
  const { origin, destination, miles, targetProfit, dispatchUser, timestamp } = req.body;
  
  const insertQuery = `
    INSERT INTO dispatch_inputs (origin, destination, miles, target_profit, dispatch_user, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  database.run(insertQuery, [
    origin || '',
    destination || '',
    parseInt(miles) || 0,
    parseInt(targetProfit) || 0,
    dispatchUser || 'dispatch',
    timestamp || new Date().toISOString()
  ], function(err) {
    if (err) {
      logger.error('Error saving dispatch inputs:', err);
      return res.status(500).json({ error: 'Failed to save dispatch inputs' });
    }
    
    logger.info('Dispatch inputs saved:', { 
      id: this.lastID, 
      origin, 
      destination, 
      miles, 
      targetProfit 
    });
    
    // Broadcast to connected clients (your laptop)
    const io = req.app.get('io');
    if (io) {
      io.emit('dispatch_inputs_updated', {
        id: this.lastID,
        origin,
        destination,
        miles,
        targetProfit,
        dispatchUser,
        timestamp,
        action: 'created'
      });
    }
    
    res.json({ 
      success: true, 
      id: this.lastID,
      message: 'Dispatch inputs saved successfully' 
    });
  });
});

// GET /api/dispatch-inputs - Get current/latest data for your laptop
router.get('/', (req, res) => {
  const { latest, limit } = req.query;
  
  let query = 'SELECT * FROM dispatch_inputs';
  let params = [];
  
  if (latest === 'true') {
    // Get the most recent entry
    query += ' ORDER BY created_at DESC LIMIT 1';
  } else {
    // Get recent entries with optional limit
    const recordLimit = parseInt(limit) || 10;
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(recordLimit);
  }
  
  database.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Error fetching dispatch inputs:', err);
      return res.status(500).json({ error: 'Failed to fetch dispatch inputs' });
    }
    
    // Convert to more user-friendly format
    const formattedRows = rows.map(row => ({
      id: row.id,
      origin: row.origin,
      destination: row.destination,
      miles: row.miles,
      targetProfit: row.target_profit,
      dispatchUser: row.dispatch_user,
      timestamp: row.timestamp,
      createdAt: row.created_at
    }));
    
    if (latest === 'true') {
      res.json(formattedRows[0] || null);
    } else {
      res.json({
        dispatchInputs: formattedRows,
        total: formattedRows.length
      });
    }
  });
});

// DELETE /api/dispatch-inputs/:id - Optional: Clear old entries
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  database.run('DELETE FROM dispatch_inputs WHERE id = ?', [id], function(err) {
    if (err) {
      logger.error('Error deleting dispatch input:', err);
      return res.status(500).json({ error: 'Failed to delete dispatch input' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Dispatch input not found' });
    }
    
    logger.info('Dispatch input deleted:', { id });
    res.json({ success: true, message: 'Dispatch input deleted' });
  });
});

// GET /api/dispatch-inputs/status - Health check for this feature
router.get('/status', (req, res) => {
  database.get('SELECT COUNT(*) as count FROM dispatch_inputs', (err, row) => {
    if (err) {
      logger.error('Error checking dispatch inputs status:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      status: 'ok',
      totalEntries: row.count,
      timestamp: new Date().toISOString()
    });
  });
});

// Comment out the immediate table creation:
// initializeDispatchInputsTable();

// And add this instead:
module.exports = router;

// Add table initialization to be called later
module.exports.initializeTable = initializeDispatchInputsTable;