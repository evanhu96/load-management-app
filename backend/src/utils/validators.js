
// backend/src/utils/validators.js
class Validators {
  static validateLoad(load) {
    const errors = [];

    if (!load.origin || typeof load.origin !== 'string') {
      errors.push('Origin is required and must be a string');
    }

    if (!load.destination || typeof load.destination !== 'string') {
      errors.push('Destination is required and must be a string');
    }

    if (!load.rate || (typeof load.rate !== 'number' && typeof load.rate !== 'string')) {
      errors.push('Rate is required and must be a number or string');
    }

    if (!load.truck || (load.truck !== 1 && load.truck !== 2)) {
      errors.push('Truck must be 1 or 2');
    }

    if (load.dho && isNaN(parseInt(load.dho))) {
      errors.push('Deadhead out must be a number');
    }

    if (load.dhd && isNaN(parseInt(load.dhd))) {
      errors.push('Deadhead destination must be a number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateTruckConfig(config) {
    const errors = [];

    if (config.mpg && (isNaN(parseFloat(config.mpg)) || config.mpg <= 0)) {
      errors.push('MPG must be a positive number');
    }

    if (config.fuelCostPerGallon && (isNaN(parseFloat(config.fuelCostPerGallon)) || config.fuelCostPerGallon < 0)) {
      errors.push('Fuel cost per gallon must be a non-negative number');
    }

    if (config.costPerMile && (isNaN(parseFloat(config.costPerMile)) || config.costPerMile < 0)) {
      errors.push('Cost per mile must be a non-negative number');
    }

    if (config.alertProfitThreshold && (isNaN(parseFloat(config.alertProfitThreshold)) || config.alertProfitThreshold < 0)) {
      errors.push('Alert profit threshold must be a non-negative number');
    }

    if (config.alertMileThreshold && (isNaN(parseInt(config.alertMileThreshold)) || config.alertMileThreshold < 0)) {
      errors.push('Alert mile threshold must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
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
}
