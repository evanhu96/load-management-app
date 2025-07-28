
// =====================================
// backend/src/utils/database.js
// =====================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'loads.db');
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath);
      
      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Loads table
      `CREATE TABLE IF NOT EXISTS loads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        rate REAL NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        dates TEXT,
        company TEXT,
        contact TEXT,
        trip TEXT,
        age TEXT,
        dho INTEGER DEFAULT 0,
        dhd INTEGER DEFAULT 0,
        truck INTEGER NOT NULL CHECK(truck IN (1, 2)),
        website TEXT,
        equipment TEXT,
        clickDetails TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT 1
      )`,

      // Truck configurations table
      `CREATE TABLE IF NOT EXISTS truck_configs (
        truck_id INTEGER PRIMARY KEY CHECK(truck_id IN (1, 2)),
        mpg REAL DEFAULT 6.5,
        fuel_cost_per_gallon REAL DEFAULT 3.50,
        cost_per_mile REAL DEFAULT 1.85,
        alert_profit_threshold REAL DEFAULT 800,
        alert_mile_threshold INTEGER DEFAULT 300,
        phone_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Alert history table
      `CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_hash TEXT NOT NULL,
        truck_id INTEGER NOT NULL,
        profit REAL,
        miles INTEGER,
        phone_number TEXT,
        message TEXT,
        status TEXT DEFAULT 'sent',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (load_hash) REFERENCES loads(hash),
        FOREIGN KEY (truck_id) REFERENCES truck_configs(truck_id)
      )`,

      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Insert default truck configurations
    await this.run(`
      INSERT OR IGNORE INTO truck_configs (truck_id, mpg, fuel_cost_per_gallon, cost_per_mile) 
      VALUES 
        (1, 6.5, 3.50, 1.85),
        (2, 6.2, 3.50, 1.90)
    `);

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_loads_truck ON loads(truck)',
      'CREATE INDEX IF NOT EXISTS idx_loads_active ON loads(active)',
      'CREATE INDEX IF NOT EXISTS idx_loads_created_at ON loads(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_alert_history_truck ON alert_history(truck_id)',
      'CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database run error:', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get error:', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all error:', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  // Transaction support
  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
}

const database = new Database();

async function initializeDatabase() {
  await database.initialize();
}

module.exports = { database, initializeDatabase };
