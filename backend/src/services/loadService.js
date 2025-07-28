// backend/src/services/loadService.js
const { database } = require('../utils/database');
const { CalculationService } = require('./calculationService');
const alertService = require('./alertService');
const { logger } = require('../utils/logger');

class LoadService {
  async getAllLoads(filters = {}) {
    try {
      const {
        truck = null,
        limit = 100,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        minProfit = null,
        maxMiles = null,
        company = null,
        origin = null,
        destination = null
      } = filters;

      let query = 'SELECT * FROM loads WHERE active = 1';
      const params = [];

      // Apply filters
      if (truck) {
        query += ' AND truck = ?';
        params.push(truck);
      }

      if (company) {
        query += ' AND company LIKE ?';
        params.push(`%${company}%`);
      }

      if (origin) {
        query += ' AND origin LIKE ?';
        params.push(`%${origin}%`);
      }

      if (destination) {
        query += ' AND destination LIKE ?';
        params.push(`%${destination}%`);
      }

      // Add sorting
      const allowedSortFields = ['created_at', 'updated_at', 'rate', 'origin', 'destination', 'company', 'truck'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortField} ${order}`;

      // Add pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const loads = await database.all(query, params);

      // If profit or mile filters are specified, we need to calculate and filter
      if (minProfit !== null || maxMiles !== null) {
        const truckConfigs = {};
        for (let i = 1; i <= 2; i++) {
          truckConfigs[i] = await this.getTruckConfigForCalculations(i);
        }

        const filteredLoads = loads.filter(load => {
          const config = truckConfigs[load.truck];
          if (!config) return true;

          const metrics = CalculationService.calculateProfit(load, config);
          
          if (minProfit !== null && metrics.profit < minProfit) return false;
          if (maxMiles !== null && metrics.miles > maxMiles) return false;
          
          return true;
        });

        return {
          loads: filteredLoads,
          total: filteredLoads.length,
          hasMore: false // Since we filtered post-query, we can't determine this accurately
        };
      }

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM loads WHERE active = 1';
      const countParams = [];

      if (truck) {
        countQuery += ' AND truck = ?';
        countParams.push(truck);
      }

      const countResult = await database.get(countQuery, countParams);
      const total = countResult.total;

      return {
        loads,
        total,
        hasMore: offset + loads.length < total,
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit),
          currentPage: Math.floor(offset / limit) + 1
        }
      };

    } catch (error) {
      logger.error('Error getting all loads', error);
      throw error;
    }
  }

  async getLoadByHash(hash) {
    try {
      const load = await database.get('SELECT * FROM loads WHERE hash = ? AND active = 1', [hash]);
      return load;
    } catch (error) {
      logger.error('Error getting load by hash', { hash, error });
      throw error;
    }
  }

  async addLoad(load) {
    try {
      const result = await database.run(`
        INSERT INTO loads (
          hash, rate, origin, destination, dates, company, contact, trip, age,
          dho, dhd, truck, website, equipment, clickDetails, source, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        load.hash,
        CalculationService.normalizeRate(load.rate),
        load.origin,
        load.destination,
        load.dates || load.date,
        load.company,
        load.contact,
        load.trip,
        load.age,
        parseInt(load.dho) || 0,
        parseInt(load.dhd) || 0,
        parseInt(load.truck),
        load.website,
        load.equipment,
        load.clickDetails,
        load.source || 'manual'
      ]);

      logger.info('Load added successfully', { hash: load.hash, id: result.id });
      return { id: result.id, message: 'Load added successfully' };
    } catch (error) {
      logger.error('Error adding load', { load: load.hash, error });
      throw error;
    }
  }

  async bulkImportLoads(loads) {
    try {
      return await database.transaction(async (db) => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO loads (
            hash, rate, origin, destination, dates, company, contact, trip, age,
            dho, dhd, truck, website, equipment, clickDetails, source, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const load of loads) {
          try {
            stmt.run([
              load.hash,
              CalculationService.normalizeRate(load.rate),
              load.origin,
              load.destination,
              load.dates || load.date,
              load.company,
              load.contact,
              load.trip,
              load.age,
              parseInt(load.dho) || 0,
              parseInt(load.dhd) || 0,
              parseInt(load.truck),
              load.website,
              load.equipment,
              load.clickDetails,
              load.source || 'bulk_import'
            ]);
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({ hash: load.hash, error: error.message });
            logger.warn('Error importing individual load', { hash: load.hash, error });
          }
        }

        stmt.finalize();

        logger.info('Bulk import completed', { 
          total: loads.length, 
          success: successCount, 
          errors: errorCount 
        });

        return {
          message: `Bulk import completed: ${successCount} successful, ${errorCount} errors`,
          successCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined
        };
      });
    } catch (error) {
      logger.error('Error in bulk import', error);
      throw error;
    }
  }

  async updateLoad(hash, load) {
    try {
      const result = await database.run(`
        UPDATE loads SET 
          rate = ?, origin = ?, destination = ?, dates = ?, company = ?, contact = ?,
          trip = ?, age = ?, dho = ?, dhd = ?, truck = ?, website = ?, equipment = ?,
          clickDetails = ?, updated_at = CURRENT_TIMESTAMP
        WHERE hash = ? AND active = 1
      `, [
        CalculationService.normalizeRate(load.rate),
        load.origin,
        load.destination,
        load.dates || load.date,
        load.company,
        load.contact,
        load.trip,
        load.age,
        parseInt(load.dho) || 0,
        parseInt(load.dhd) || 0,
        parseInt(load.truck),
        load.website,
        load.equipment,
        load.clickDetails,
        hash
      ]);

      if (result.changes > 0) {
        logger.info('Load updated successfully', { hash });
      }

      return result;
    } catch (error) {
      logger.error('Error updating load', { hash, error });
      throw error;
    }
  }

  async deleteLoad(hash, permanent = false) {
    try {
      let result;
      
      if (permanent) {
        result = await database.run('DELETE FROM loads WHERE hash = ?', [hash]);
      } else {
        result = await database.run(
          'UPDATE loads SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE hash = ? AND active = 1',
          [hash]
        );
      }

      if (result.changes > 0) {
        logger.info('Load deleted', { hash, permanent });
      }

      return result;
    } catch (error) {
      logger.error('Error deleting load', { hash, error });
      throw error;
    }
  }

  async getLoadStats(truck = null, timeRange = '24h') {
    try {
      const timeConditions = {
        '1h': "datetime('now', '-1 hour')",
        '24h': "datetime('now', '-1 day')",
        '7d': "datetime('now', '-7 days')",
        '30d': "datetime('now', '-30 days')"
      };

      const timeCondition = timeConditions[timeRange] || timeConditions['24h'];
      
      let query = `
        SELECT 
          COUNT(*) as total_loads,
          COUNT(DISTINCT truck) as trucks_with_loads,
          AVG(rate) as avg_rate,
          MIN(rate) as min_rate,
          MAX(rate) as max_rate,
          AVG(dho + dhd) as avg_miles,
          truck
        FROM loads 
        WHERE active = 1 AND created_at >= ${timeCondition}
      `;

      if (truck) {
        query += ' AND truck = ?';
      }

      query += ' GROUP BY truck';

      const params = truck ? [truck] : [];
      const stats = await database.all(query, params);

      return {
        timeRange,
        stats,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting load stats', error);
      throw error;
    }
  }

  async checkAndSendAlert(load) {
    try {
      const truckConfig = await this.getTruckConfigForCalculations(load.truck);
      if (!truckConfig) return;

      const shouldAlert = CalculationService.shouldAlert(load, truckConfig);
      
      if (shouldAlert) {
        // Check if we've already sent an alert for this load
        const existingAlert = await database.get(
          'SELECT id FROM alert_history WHERE load_hash = ?',
          [load.hash]
        );

        if (!existingAlert) {
          await alertService.sendLoadAlert(load, truckConfig);
        }
      }
    } catch (error) {
      logger.error('Error checking/sending alert', { load: load.hash, error });
    }
  }

  async getTruckConfigForCalculations(truckId) {
    try {
      const config = await database.get(
        'SELECT * FROM truck_configs WHERE truck_id = ?',
        [truckId]
      );
      return config;
    } catch (error) {
      logger.error('Error getting truck config for calculations', { truckId, error });
      return null;
    }
  }
}

module.exports = new LoadService();
