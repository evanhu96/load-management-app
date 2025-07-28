// backend/src/middleware/validation.js
const { logger } = require('../utils/logger');

class Validators {
  static validateLoad(load) {
    const errors = [];

    // Required fields
    if (!load.hash || typeof load.hash !== 'string') {
      errors.push('Hash is required and must be a string');
    }

    if (!load.origin || typeof load.origin !== 'string') {
      errors.push('Origin is required and must be a string');
    }

    if (!load.destination || typeof load.destination !== 'string') {
      errors.push('Destination is required and must be a string');
    }

    if (!load.rate || (typeof load.rate !== 'number' && typeof load.rate !== 'string')) {
      errors.push('Rate is required and must be a number or string');
    } else {
      const rate = typeof load.rate === 'string' ? 
        parseFloat(load.rate.replace(/[$,]/g, '')) : parseFloat(load.rate);
      if (isNaN(rate) || rate < 0) {
        errors.push('Rate must be a valid positive number');
      }
    }

    if (!load.truck || (load.truck !== 1 && load.truck !== 2 && parseInt(load.truck) !== 1 && parseInt(load.truck) !== 2)) {
      errors.push('Truck must be 1 or 2');
    }

    // Optional field validation
    if (load.dho && (isNaN(parseInt(load.dho)) || parseInt(load.dho) < 0)) {
      errors.push('Deadhead out must be a non-negative number');
    }

    if (load.dhd && (isNaN(parseInt(load.dhd)) || parseInt(load.dhd) < 0)) {
      errors.push('Deadhead destination must be a non-negative number');
    }

    if (load.company && typeof load.company !== 'string') {
      errors.push('Company must be a string');
    }

    if (load.contact && typeof load.contact !== 'string') {
      errors.push('Contact must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateTruckConfig(config) {
    const errors = [];

    if (config.mpg !== undefined) {
      const mpg = parseFloat(config.mpg);
      if (isNaN(mpg) || mpg <= 0 || mpg > 50) {
        errors.push('MPG must be a positive number between 0 and 50');
      }
    }

    if (config.fuelCostPerGallon !== undefined || config.fuel_cost_per_gallon !== undefined) {
      const fuelCost = parseFloat(config.fuelCostPerGallon || config.fuel_cost_per_gallon);
      if (isNaN(fuelCost) || fuelCost < 0 || fuelCost > 20) {
        errors.push('Fuel cost per gallon must be a number between 0 and 20');
      }
    }

    if (config.costPerMile !== undefined || config.cost_per_mile !== undefined) {
      const costPerMile = parseFloat(config.costPerMile || config.cost_per_mile);
      if (isNaN(costPerMile) || costPerMile < 0 || costPerMile > 10) {
        errors.push('Cost per mile must be a number between 0 and 10');
      }
    }

    if (config.alertProfitThreshold !== undefined || config.alert_profit_threshold !== undefined) {
      const threshold = parseFloat(config.alertProfitThreshold || config.alert_profit_threshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 10000) {
        errors.push('Alert profit threshold must be a number between 0 and 10000');
      }
    }

    if (config.alertMileThreshold !== undefined || config.alert_mile_threshold !== undefined) {
      const mileThreshold = parseInt(config.alertMileThreshold || config.alert_mile_threshold);
      if (isNaN(mileThreshold) || mileThreshold < 0 || mileThreshold > 5000) {
        errors.push('Alert mile threshold must be a number between 0 and 5000');
      }
    }

    if (config.phoneNumber !== undefined || config.phone_number !== undefined) {
      const phone = config.phoneNumber || config.phone_number;
      if (phone && !this.isValidPhoneNumber(phone)) {
        errors.push('Phone number must be a valid format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static isValidPhoneNumber(phone) {
    if (!phone) return true; // Optional field
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    return digits.length >= 10 && digits.length <= 15;
  }

  static sanitizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if it's a 10-digit US number
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if it starts with country code
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return digits.length >= 10 ? `+${digits}` : null;
  }

  static validateSystemSettings(settings) {
    const errors = [];
    const allowedSettings = [
      'sms_enabled',
      'default_phone_number',
      'alert_cooldown_minutes',
      'auto_refresh_interval',
      'max_loads_per_page'
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedSettings.includes(key)) {
        errors.push(`Unknown setting: ${key}`);
        continue;
      }

      switch (key) {
        case 'sms_enabled':
          if (value !== 'true' && value !== 'false') {
            errors.push('sms_enabled must be "true" or "false"');
          }
          break;
        case 'default_phone_number':
          if (value && !this.isValidPhoneNumber(value)) {
            errors.push('default_phone_number must be a valid phone number');
          }
          break;
        case 'alert_cooldown_minutes':
          const cooldown = parseInt(value);
          if (isNaN(cooldown) || cooldown < 0 || cooldown > 1440) {
            errors.push('alert_cooldown_minutes must be between 0 and 1440');
          }
          break;
        case 'auto_refresh_interval':
          const interval = parseInt(value);
          if (isNaN(interval) || interval < 5 || interval > 300) {
            errors.push('auto_refresh_interval must be between 5 and 300 seconds');
          }
          break;
        case 'max_loads_per_page':
          const maxLoads = parseInt(value);
          if (isNaN(maxLoads) || maxLoads < 10 || maxLoads > 500) {
            errors.push('max_loads_per_page must be between 10 and 500');
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

const validationMiddleware = {
  validateLoadData: (req, res, next) => {
    const validation = Validators.validateLoad(req.body);
    
    if (!validation.isValid) {
      logger.warn('Load validation failed', { errors: validation.errors, body: req.body });
      return res.status(400).json({
        error: 'Invalid load data',
        details: validation.errors
      });
    }
    
    next();
  },

  validateBulkLoadData: (req, res, next) => {
    const { loads } = req.body;
    
    if (!Array.isArray(loads)) {
      return res.status(400).json({
        error: 'Loads must be an array'
      });
    }

    if (loads.length === 0) {
      return res.status(400).json({
        error: 'Loads array cannot be empty'
      });
    }

    if (loads.length > 1000) {
      return res.status(400).json({
        error: 'Cannot import more than 1000 loads at once'
      });
    }

    const errors = [];
    loads.forEach((load, index) => {
      const validation = Validators.validateLoad(load);
      if (!validation.isValid) {
        errors.push({
          index,
          hash: load.hash,
          errors: validation.errors
        });
      }
    });

    // Allow partial errors but warn about them
    if (errors.length > 0) {
      logger.warn('Bulk load validation errors', { errorCount: errors.length, totalLoads: loads.length });
      req.validationErrors = errors;
    }

    next();
  },

  validateTruckConfig: (req, res, next) => {
    const validation = Validators.validateTruckConfig(req.body);
    
    if (!validation.isValid) {
      logger.warn('Truck config validation failed', { errors: validation.errors, body: req.body });
      return res.status(400).json({
        error: 'Invalid truck configuration',
        details: validation.errors
      });
    }
    
    next();
  },

  validateTruckId: (req, res, next) => {
    const { id } = req.params;
    const truckId = parseInt(id);
    
    if (truckId !== 1 && truckId !== 2) {
      return res.status(400).json({
        error: 'Truck ID must be 1 or 2'
      });
    }
    
    req.truckId = truckId;
    next();
  },

  validatePagination: (req, res, next) => {
    const { limit = 100, offset = 0 } = req.query;
    
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 500'
      });
    }
    
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        error: 'Offset must be a non-negative number'
      });
    }
    
    req.pagination = { limit: parsedLimit, offset: parsedOffset };
    next();
  },

  validateSystemSettings: (req, res, next) => {
    const validation = Validators.validateSystemSettings(req.body);
    
    if (!validation.isValid) {
      logger.warn('System settings validation failed', { errors: validation.errors });
      return res.status(400).json({
        error: 'Invalid system settings',
        details: validation.errors
      });
    }
    
    next();
  }
};

module.exports = { Validators, validationMiddleware };
