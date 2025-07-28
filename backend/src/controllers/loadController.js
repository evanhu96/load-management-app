// =====================================
// backend/src/controllers/loadController.js
// =====================================

const loadService = require('../services/loadService');
const { logger } = require('../utils/logger');

class LoadController {
  async getAllLoads(req, res) {
    try {
      const {
        truck,
        limit = 100,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        minProfit,
        maxMiles,
        company,
        origin,
        destination
      } = req.query;

      const filters = {
        truck: truck ? parseInt(truck) : null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy,
        sortOrder,
        minProfit: minProfit ? parseFloat(minProfit) : null,
        maxMiles: maxMiles ? parseInt(maxMiles) : null,
        company,
        origin,
        destination
      };

      const result = await loadService.getAllLoads(filters);
      res.json(result);
    } catch (error) {
      logger.error('Error getting loads', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLoadByHash(req, res) {
    try {
      const { hash } = req.params;
      const load = await loadService.getLoadByHash(hash);
      
      if (!load) {
        return res.status(404).json({ error: 'Load not found' });
      }
      
      res.json(load);
    } catch (error) {
      logger.error('Error getting load by hash', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addLoad(req, res) {
    try {
      const load = req.body;
      const result = await loadService.addLoad(load);
      
      // Emit real-time update
      req.app.get('io').emit('load_update', load);
      
      // Check for alerts
      await loadService.checkAndSendAlert(load);
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error adding load', error);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Load with this hash already exists' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  async bulkImportLoads(req, res) {
    try {
      const { loads } = req.body;
      
      if (!Array.isArray(loads) || loads.length === 0) {
        return res.status(400).json({ error: 'Loads array is required and cannot be empty' });
      }

      const result = await loadService.bulkImportLoads(loads);
      
      // Emit real-time update
      req.app.get('io').emit('loads_bulk_update', loads);
      
      // Check alerts for all loads asynchronously
      setImmediate(async () => {
        for (const load of loads) {
          try {
            await loadService.checkAndSendAlert(load);
          } catch (alertError) {
            logger.error('Error checking alert for load', { load: load.hash, error: alertError });
          }
        }
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Error bulk importing loads', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateLoad(req, res) {
    try {
      const { hash } = req.params;
      const load = req.body;
      
      const result = await loadService.updateLoad(hash, load);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Load not found' });
      }
      
      // Emit real-time update
      req.app.get('io').emit('load_update', { ...load, hash });
      
      res.json({ message: 'Load updated successfully', changes: result.changes });
    } catch (error) {
      logger.error('Error updating load', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteLoad(req, res) {
    try {
      const { hash } = req.params;
      const { permanent = false } = req.query;
      
      const result = await loadService.deleteLoad(hash, permanent === 'true');
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Load not found' });
      }
      
      // Emit real-time update
      req.app.get('io').emit('load_deleted', { hash });
      
      res.json({ 
        message: permanent ? 'Load permanently deleted' : 'Load deactivated successfully',
        changes: result.changes 
      });
    } catch (error) {
      logger.error('Error deleting load', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLoadStats(req, res) {
    try {
      const { truck, timeRange = '24h' } = req.query;
      const stats = await loadService.getLoadStats(truck, timeRange);
      res.json(stats);
    } catch (error) {
      logger.error('Error getting load stats', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new LoadController();
