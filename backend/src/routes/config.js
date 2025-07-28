
// =====================================
// backend/src/routes/config.js
// =====================================

const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { validationMiddleware } = require('../middleware/validation');

// GET /api/trucks - Get all truck configurations
router.get('/trucks', configController.getAllTruckConfigs);

// GET /api/trucks/:id/config - Get specific truck configuration
router.get('/trucks/:id/config', configController.getTruckConfig);

// PUT /api/trucks/:id/config - Update truck configuration
router.put('/trucks/:id/config', validationMiddleware.validateTruckConfig, configController.updateTruckConfig);

// POST /api/trucks/:id/config/reset - Reset truck config to defaults
router.post('/trucks/:id/config/reset', configController.resetTruckConfig);

// GET /api/system/settings - Get system settings
router.get('/system/settings', configController.getSystemSettings);

// PUT /api/system/settings - Update system settings
router.put('/system/settings', configController.updateSystemSettings);

module.exports = router;
