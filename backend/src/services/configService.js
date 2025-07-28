
// =====================================
// backend/src/services/configService.js
// =====================================

const { database } = require('../utils/database');
const { logger } = require('../utils/logger');

class ConfigService {
  async getTruckConfig(truckId) {
    try {
      const config = await database.get(
        'SELECT * FROM truck_configs WHERE truck_id = ?',
        [truckId]
      );

      if (!config) {
        // Return default config if none exists
        return {
          truck_id: truckId,
          mpg: truckId === 1 ? 6.5 : 6.2,
          fuel_cost_per_gallon: 3.50,
          cost_per_mile: truckId === 1 ? 1.85 : 1.90,
          alert_profit_threshold: truckId === 1 ? 800 : 750,
          alert_mile_threshold: truckId === 1 ? 300 : 350
        };
      }

      return config;
    } catch (error) {
      logger.error('Error getting truck config', { truckId, error });
      throw error;
    }
  }

  async getAllTruckConfigs() {
    try {
      const configs = await database.all('SELECT * FROM truck_configs ORDER BY truck_id');
      
      // Ensure we have configs for both trucks
      const configMap = new Map(configs.map(c => [c.truck_id, c]));
      
      for (let i = 1; i <= 2; i++) {
        if (!configMap.has(i)) {
          const defaultConfig = await this.getTruckConfig(i);
          configMap.set(i, defaultConfig);
        }
      }

      return Array.from(configMap.values());
    } catch (error) {
      logger.error('Error getting all truck configs', error);
      throw error;
    }
  }

  async updateTruckConfig(truckId, config) {
    try {
      const result = await database.run(`
        INSERT OR REPLACE INTO truck_configs (
          truck_id, mpg, fuel_cost_per_gallon, cost_per_mile,
          alert_profit_threshold, alert_mile_threshold, phone_number, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        truckId,
        parseFloat(config.mpg) || 6.5,
        parseFloat(config.fuelCostPerGallon || config.fuel_cost_per_gallon) || 3.50,
        parseFloat(config.costPerMile || config.cost_per_mile) || 1.85,
        parseFloat(config.alertProfitThreshold || config.alert_profit_threshold) || 800,
        parseInt(config.alertMileThreshold || config.alert_mile_threshold) || 300,
        config.phoneNumber || config.phone_number || null
      ]);

      logger.info('Truck config updated', { truckId });
      return { message: 'Truck configuration updated successfully' };
    } catch (error) {
      logger.error('Error updating truck config', { truckId, error });
      throw error;
    }
  }

  async resetTruckConfig(truckId) {
    try {
      const defaultConfig = {
        mpg: truckId === 1 ? 6.5 : 6.2,
        fuel_cost_per_gallon: 3.50,
        cost_per_mile: truckId === 1 ? 1.85 : 1.90,
        alert_profit_threshold: truckId === 1 ? 800 : 750,
        alert_mile_threshold: truckId === 1 ? 300 : 350
      };

      await this.updateTruckConfig(truckId, defaultConfig);
      
      logger.info('Truck config reset to defaults', { truckId });
      return { 
        message: 'Truck configuration reset to defaults',
        config: { truck_id: truckId, ...defaultConfig }
      };
    } catch (error) {
      logger.error('Error resetting truck config', { truckId, error });
      throw error;
    }
  }

  async getSystemSettings() {
    try {
      const settings = await database.all('SELECT key, value FROM system_settings');
      
      const settingsObj = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      // Return default settings if none exist
      return {
        sms_enabled: settingsObj.sms_enabled || 'false',
        default_phone_number: settingsObj.default_phone_number || '',
        alert_cooldown_minutes: settingsObj.alert_cooldown_minutes || '60',
        auto_refresh_interval: settingsObj.auto_refresh_interval || '30',
        max_loads_per_page: settingsObj.max_loads_per_page || '100',
        ...settingsObj
      };
    } catch (error) {
      logger.error('Error getting system settings', error);
      throw error;
    }
  }

  async updateSystemSettings(settings) {
    try {
      return await database.transaction(async (db) => {
        for (const [key, value] of Object.entries(settings)) {
          await db.run(`
            INSERT OR REPLACE INTO system_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `, [key, String(value)]);
        }

        logger.info('System settings updated', { keys: Object.keys(settings) });
        return { message: 'System settings updated successfully' };
      });
    } catch (error) {
      logger.error('Error updating system settings', error);
      throw error;
    }
  }
}

module.exports = new ConfigService();
