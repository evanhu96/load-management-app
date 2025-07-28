
// =====================================
// backend/src/controllers/configController.js
// =====================================

const configService = require('../services/configService');
const { logger } = require('../utils/logger');

class ConfigController {
  async getTruckConfig(req, res) {
    try {
      const { id } = req.params;
      const truckId = parseInt(id);
      
      if (truckId !== 1 && truckId !== 2) {
        return res.status(400).json({ error: 'Truck ID must be 1 or 2' });
      }
      
      const config = await configService.getTruckConfig(truckId);
      res.json(config);
    } catch (error) {
      logger.error('Error getting truck config', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAllTruckConfigs(req, res) {
    try {
      const configs = await configService.getAllTruckConfigs();
      res.json(configs);
    } catch (error) {
      logger.error('Error getting all truck configs', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateTruckConfig(req, res) {
    try {
      const { id } = req.params;
      const truckId = parseInt(id);
      const config = req.body;
      
      if (truckId !== 1 && truckId !== 2) {
        return res.status(400).json({ error: 'Truck ID must be 1 or 2' });
      }
      
      const result = await configService.updateTruckConfig(truckId, config);
      
      // Emit configuration update
      req.app.get('io').emit('config_updated', { truckId, config });
      
      res.json(result);
    } catch (error) {
      logger.error('Error updating truck config', error);
      res.status(500).json({ error: error.message });
    }
  }

  async resetTruckConfig(req, res) {
    try {
      const { id } = req.params;
      const truckId = parseInt(id);
      
      if (truckId !== 1 && truckId !== 2) {
        return res.status(400).json({ error: 'Truck ID must be 1 or 2' });
      }
      
      const result = await configService.resetTruckConfig(truckId);
      
      // Emit configuration update
      req.app.get('io').emit('config_updated', { truckId, config: result });
      
      res.json(result);
    } catch (error) {
      logger.error('Error resetting truck config', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSystemSettings(req, res) {
    try {
      const settings = await configService.getSystemSettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error getting system settings', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateSystemSettings(req, res) {
    try {
      const settings = req.body;
      const result = await configService.updateSystemSettings(settings);
      
      // Emit settings update
      req.app.get('io').emit('settings_updated', settings);
      
      res.json(result);
    } catch (error) {
      logger.error('Error updating system settings', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ConfigController();
