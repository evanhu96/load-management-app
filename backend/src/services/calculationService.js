// backend/src/services/calculationService.js
class CalculationService {
  /**
   * Calculate total miles for a load
   * @param {number} deadheadOut - Miles to pickup
   * @param {number} deadheadDest - Miles from delivery
   * @returns {number} Total miles
   */
  static calculateTotalMiles(deadheadOut, deadheadDest) {
    return parseInt(deadheadOut || 0) + parseInt(deadheadDest || 0);
  }

  /**
   * Calculate fuel cost for a trip
   * @param {number} miles - Total miles
   * @param {object} truckConfig - Truck configuration
   * @returns {number} Fuel cost
   */
  static calculateFuelCost(miles, truckConfig) {
    const mpg = truckConfig.mpg || 6.5;
    const fuelPrice = truckConfig.fuel_cost_per_gallon || 3.50;
    return (miles / mpg) * fuelPrice;
  }

  /**
   * Calculate operating cost for a trip
   * @param {number} miles - Total miles
   * @param {object} truckConfig - Truck configuration
   * @returns {number} Operating cost
   */
  static calculateOperatingCost(miles, truckConfig) {
    const costPerMile = truckConfig.cost_per_mile || 1.85;
    return miles * costPerMile;
  }

  /**
   * Calculate profit for a load
   * @param {object} load - Load data
   * @param {object} truckConfig - Truck configuration
   * @returns {object} Detailed profit breakdown
   */
  static calculateProfit(load, truckConfig) {
    const rate = this.normalizeRate(load.rate);
    const miles = this.calculateTotalMiles(load.dho, load.dhd);
    const fuelCost = this.calculateFuelCost(miles, truckConfig);
    const operatingCost = this.calculateOperatingCost(miles, truckConfig);
    const totalCosts = fuelCost + operatingCost;
    const profit = rate - totalCosts;
    const profitMargin = rate > 0 ? (profit / rate) * 100 : 0;

    return {
      rate,
      miles,
      fuelCost: Math.round(fuelCost * 100) / 100,
      operatingCost: Math.round(operatingCost * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      profitPerMile: miles > 0 ? Math.round((profit / miles) * 100) / 100 : 0
    };
  }

  /**
   * Normalize rate from various formats
   * @param {string|number} rate - Rate value
   * @returns {number} Normalized rate
   */
  static normalizeRate(rate) {
    if (typeof rate === 'string') {
      return parseFloat(rate.replace(/[$,]/g, '')) || 0;
    }
    return parseFloat(rate) || 0;
  }

  /**
   * Calculate efficiency metrics
   * @param {object} load - Load data
   * @param {object} truckConfig - Truck configuration
   * @returns {object} Efficiency metrics
   */
  static calculateEfficiencyMetrics(load, truckConfig) {
    const profit = this.calculateProfit(load, truckConfig);
    const loadedMiles = parseInt(load.loaded_miles || 0);
    const emptyMiles = profit.miles - loadedMiles;
    const utilizationRate = profit.miles > 0 ? (loadedMiles / profit.miles) * 100 : 0;

    return {
      ...profit,
      loadedMiles,
      emptyMiles,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      revenuePerMile: profit.miles > 0 ? Math.round((profit.rate / profit.miles) * 100) / 100 : 0
    };
  }

  /**
   * Determine if load meets alert criteria
   * @param {object} load - Load data
   * @param {object} truckConfig - Truck configuration
   * @returns {boolean} Whether load should trigger alert
   */
  static shouldAlert(load, truckConfig) {
    const profit = this.calculateProfit(load, truckConfig);
    return profit.profit >= (truckConfig.alert_profit_threshold || 800) && 
           profit.miles <= (truckConfig.alert_mile_threshold || 300);
  }
}
