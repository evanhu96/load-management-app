
// =====================================
// backend/src/controllers/alertController.js
// =====================================

const alertService = require('../services/alertService');
const { logger } = require('../utils/logger');

class AlertController {
  async getAlertHistory(req, res) {
    try {
      const {
        limit = 50,
        offset = 0,
        truck,
        startDate,
        endDate,
        status
      } = req.query;

      const filters = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        truck: truck ? parseInt(truck) : null,
        startDate,
        endDate,
        status
      };

      const alerts = await alertService.getAlertHistory(filters);
      res.json(alerts);
    } catch (error) {
      logger.error('Error getting alert history', error);
      res.status(500).json({ error: error.message });
    }
  }

  async sendTestAlert(req, res) {
    try {
      const { phoneNumber, message = 'Test alert from Load Management System' } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const result = await alertService.sendTestAlert(phoneNumber, message);
      
      // Log the test alert
      await alertService.logTestAlert(phoneNumber, message, result.status);
      
      res.json(result);
    } catch (error) {
      logger.error('Error sending test alert', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAlertSummary(req, res) {
    try {
      const { period = 'daily', truck } = req.query;
      const summary = await alertService.getAlertSummary(period, truck);
      res.json(summary);
    } catch (error) {
      logger.error('Error getting alert summary', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateAlertSettings(req, res) {
    try {
      const settings = req.body;
      const result = await alertService.updateAlertSettings(settings);
      
      // Emit settings update
      req.app.get('io').emit('alert_settings_updated', settings);
      
      res.json(result);
    } catch (error) {
      logger.error('Error updating alert settings', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteAlert(req, res) {
    try {
      const { id } = req.params;
      const result = await alertService.deleteAlert(parseInt(id));
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      
      res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
      logger.error('Error deleting alert', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AlertController();