// =====================================
// backend/src/services/alertService.js
// =====================================

const twilio = require("twilio");
const { database } = require("../utils/database");
const { CalculationService } = require("./calculationService");
const { logger } = require("../utils/logger");

class AlertService {
  constructor() {
    this.twilioClient = null;
    this.initializeTwilio();
  }

  initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    // Only initialize if both credentials are provided AND valid
    if (accountSid && authToken && accountSid.startsWith("AC")) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
        console.log("Twilio SMS service initialized");
      } catch (error) {
        console.warn("Twilio initialization failed:", error.message);
        this.twilioClient = null;
      }
    } else {
      console.log(
        "Twilio credentials not configured or invalid. SMS alerts will be logged only."
      );
      this.twilioClient = null;
    }
  }

  formatAlertMessage(load, metrics) {
    const rateStr =
      typeof load.rate === "string"
        ? load.rate
        : `$${load.rate.toLocaleString()}`;

    return (
      `🚛 TRUCK ${load.truck} HIGH PROFIT ALERT!\n\n` +
      `${load.origin} → ${load.destination}\n` +
      `💰 Profit: $${metrics.profit.toLocaleString()}\n` +
      `💵 Rate: ${rateStr}\n` +
      `📏 Miles: ${metrics.miles}\n` +
      `⛽ Fuel: $${metrics.fuelCost}\n` +
      `🔧 Operating: $${metrics.operatingCost}\n` +
      `📊 Margin: ${metrics.profitMargin}%\n\n` +
      `🏢 ${load.company}\n` +
      `📞 ${load.contact}\n` +
      `📋 Trip: ${load.trip}`
    );
  }

  async sendSMS(message, phoneNumber) {
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!this.twilioClient || !fromNumber || !phoneNumber) {
      logger.info("SMS Alert (not sent - missing config)", {
        message,
        phoneNumber,
      });
      return { status: "logged", message: "Missing SMS configuration" };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phoneNumber,
      });

      logger.info("SMS sent successfully", {
        sid: result.sid,
        to: phoneNumber,
      });
      return { status: "sent", sid: result.sid };
    } catch (error) {
      logger.error("SMS sending failed", { error: error.message, phoneNumber });
      return { status: "failed", error: error.message };
    }
  }

  async sendLoadAlert(load, truckConfig) {
    try {
      const metrics = CalculationService.calculateProfit(load, truckConfig);
      const message = this.formatAlertMessage(load, metrics);

      const phoneNumber =
        truckConfig.phone_number || process.env.ALERT_PHONE_NUMBER;
      const result = await this.sendSMS(message, phoneNumber);

      // Log the alert
      await this.logAlert(load, metrics, phoneNumber, message, result.status);

      return result;
    } catch (error) {
      logger.error("Error sending load alert", { load: load.hash, error });
      throw error;
    }
  }

  async logAlert(load, metrics, phoneNumber, message, status) {
    try {
      await database.run(
        `
        INSERT INTO alert_history (load_hash, truck_id, profit, miles, phone_number, message, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          load.hash,
          load.truck,
          metrics.profit,
          metrics.miles,
          phoneNumber,
          message,
          status,
        ]
      );
    } catch (error) {
      logger.error("Error logging alert", error);
    }
  }

  async getAlertHistory(filters = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        truck = null,
        startDate = null,
        endDate = null,
        status = null,
      } = filters;

      let query = `
        SELECT ah.*, l.origin, l.destination, l.company, l.rate
        FROM alert_history ah 
        LEFT JOIN loads l ON ah.load_hash = l.hash 
        WHERE 1=1
      `;
      const params = [];

      if (truck) {
        query += " AND ah.truck_id = ?";
        params.push(truck);
      }

      if (startDate) {
        query += " AND ah.sent_at >= ?";
        params.push(startDate);
      }

      if (endDate) {
        query += " AND ah.sent_at <= ?";
        params.push(endDate);
      }

      if (status) {
        query += " AND ah.status = ?";
        params.push(status);
      }

      query += " ORDER BY ah.sent_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const alerts = await database.all(query, params);
      return alerts;
    } catch (error) {
      logger.error("Error getting alert history", error);
      throw error;
    }
  }

  async sendTestAlert(phoneNumber, message) {
    const testMessage = message || "Test alert from Load Management System";
    const result = await this.sendSMS(testMessage, phoneNumber);

    logger.info("Test alert sent", { phoneNumber, status: result.status });
    return result;
  }

  async logTestAlert(phoneNumber, message, status) {
    try {
      await database.run(
        `
        INSERT INTO alert_history (load_hash, truck_id, profit, miles, phone_number, message, status)
        VALUES ('TEST', 0, 0, 0, ?, ?, ?)
      `,
        [phoneNumber, message, status]
      );
    } catch (error) {
      logger.error("Error logging test alert", error);
    }
  }

  async getAlertSummary(period = "daily", truck = null) {
    try {
      const periodMap = {
        daily: "date(sent_at) = date('now')",
        weekly: "sent_at >= datetime('now', '-7 days')",
        monthly: "sent_at >= datetime('now', '-30 days')",
      };

      const periodCondition = periodMap[period] || periodMap.daily;

      let query = `
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_alerts,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_alerts,
          truck_id,
          AVG(profit) as avg_profit,
          AVG(miles) as avg_miles
        FROM alert_history 
        WHERE ${periodCondition}
      `;

      if (truck) {
        query += " AND truck_id = ?";
      }

      query += " GROUP BY truck_id";

      const params = truck ? [truck] : [];
      const summary = await database.all(query, params);

      return {
        period,
        summary,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting alert summary", error);
      throw error;
    }
  }

  async deleteAlert(alertId) {
    try {
      const result = await database.run(
        "DELETE FROM alert_history WHERE id = ?",
        [alertId]
      );

      if (result.changes > 0) {
        logger.info("Alert deleted", { alertId });
      }

      return result;
    } catch (error) {
      logger.error("Error deleting alert", { alertId, error });
      throw error;
    }
  }
}

module.exports = new AlertService();
