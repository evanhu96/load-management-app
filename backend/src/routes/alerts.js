
// =====================================
// backend/src/routes/alerts.js
// =====================================

const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// GET /api/alerts - Get alert history
router.get('/', alertController.getAlertHistory);

// POST /api/alerts/test - Send test alert
router.post('/test', alertController.sendTestAlert);

// GET /api/alerts/summary - Get daily/weekly summary
router.get('/summary', alertController.getAlertSummary);

// POST /api/alerts/settings - Update alert settings
router.post('/settings', alertController.updateAlertSettings);

// DELETE /api/alerts/:id - Delete alert from history
router.delete('/:id', alertController.deleteAlert);

module.exports = router;

