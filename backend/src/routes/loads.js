// backend/src/routes/loads.js
const express = require('express');
const router = express.Router();
const loadController = require('../controllers/loadController');
const { validationMiddleware } = require('../middleware/validation');
const { authMiddleware } = require('../middleware/auth');

// GET /api/loads - Get all loads with optional filtering
router.get('/', loadController.getAllLoads);

// GET /api/loads/:hash - Get specific load
router.get('/:hash', loadController.getLoadByHash);

// POST /api/loads - Add single load
router.post('/', validationMiddleware.validateLoadData, loadController.addLoad);

// POST /api/loads/bulk - Bulk import loads
router.post('/bulk', validationMiddleware.validateBulkLoadData, loadController.bulkImportLoads);

// PUT /api/loads/:hash - Update load
router.put('/:hash', validationMiddleware.validateLoadData, loadController.updateLoad);

// DELETE /api/loads/:hash - Delete/deactivate load
router.delete('/:hash', loadController.deleteLoad);

// GET /api/loads/stats/summary - Get load statistics
router.get('/stats/summary', loadController.getLoadStats);

module.exports = router;
