// remote-client/src/dataCollector.js
const fs = require("fs").promises;
const path = require("path");
const io = require("socket.io-client");
const chokidar = require("chokidar");
const fetch = require("node-fetch");
require("dotenv").config();

class LoadDataCollector {
  constructor(config) {
    this.config = {
      serverUrl:
        config.serverUrl || process.env.SERVER_URL || "http://localhost:3001",
      watchPaths: config.watchPaths || this.getDefaultWatchPaths(),
      retryInterval: config.retryInterval || 5000,
      maxRetries: config.maxRetries || 5,
      batchSize: config.batchSize || 100,
      ...config,
    };

    this.socket = null;
    this.isConnected = false;
    this.watchedFiles = new Set();
    this.lastProcessedTimes = new Map();
    this.fileWatcher = null;
    this.retryCount = 0;
    this.connectionId = null;
    this.stats = {
      totalLoadsProcessed: 0,
      lastProcessedAt: null,
      errors: [],
      connectionTime: null,
    };
  }

  getDefaultWatchPaths() {
    return [
      "./loads.json",
      "./tsLoads.json",
      "./data/loads.json",
      "./data/tsLoads.json",
      path.join(process.cwd(), "loads.json"),
      path.join(process.cwd(), "tsLoads.json"),
    ];
  }

  async initialize() {
    try {
      this.log("info", "Initializing Load Data Collector...");
      this.log("info", `Server URL: ${this.config.serverUrl}`);
      this.log("info", `Watch paths: ${this.config.watchPaths.join(", ")}`);

      await this.connectToServer();
      await this.setupFileWatchers();
      this.startHeartbeat();
      this.startStatsLogging();

      this.log("info", "Load Data Collector initialized successfully");
      this.retryCount = 0;
    } catch (error) {
      this.log("error", "Failed to initialize collector", error);
      this.handleConnectionError(error);
    }
  }

  async connectToServer() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.serverUrl, {
        reconnection: true,
        reconnectionDelay: this.config.retryInterval,
        reconnectionAttempts: this.config.maxRetries,
        timeout: 10000,
      });

      const connectionTimeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 15000);

      this.socket.on("connect", () => {
        clearTimeout(connectionTimeout);
        this.connectionId = this.socket.id;
        this.stats.connectionTime = new Date();
        this.log("info", `Connected to server (ID: ${this.connectionId})`);
        this.isConnected = true;

        // Identify as remote client
        this.socket.emit("identify", {
          type: "remote-client",
          version: "1.0.0",
          hostname: require("os").hostname(),
          platform: process.platform,
        });

        resolve();
      });

      this.socket.on("disconnect", (reason) => {
        this.log("warn", `Disconnected from server: ${reason}`);
        this.isConnected = false;
        this.connectionId = null;
      });

      this.socket.on("connect_error", (error) => {
        clearTimeout(connectionTimeout);
        this.log("error", "Connection error", error);
        reject(error);
      });

      this.socket.on("reconnect", (attemptNumber) => {
        this.log("info", `Reconnected to server (attempt ${attemptNumber})`);
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.socket.on("reconnect_failed", () => {
        this.log("error", "Failed to reconnect to server");
        this.isConnected = false;
      });

      // Handle server messages
      this.socket.on("connected", (data) => {
        this.log("info", "Server welcome message received", data);
      });

      this.socket.on("heartbeat_ack", (data) => {
        this.log("debug", "Heartbeat acknowledged", data);
      });

      this.socket.on("refresh_requested", () => {
        this.log("info", "Refresh requested by server");
        this.processPendingFiles();
      });
    });
  }

  async setupFileWatchers() {
    try {
      // Filter watch paths to only existing files/directories
      const validPaths = [];
      for (const watchPath of this.config.watchPaths) {
        try {
          await fs.access(watchPath);
          validPaths.push(watchPath);
        } catch {
          // Check if parent directory exists
          const dir = path.dirname(watchPath);
          try {
            await fs.access(dir);
            validPaths.push(watchPath); // Watch for file creation
          } catch {
            this.log("warn", `Watch path not accessible: ${watchPath}`);
          }
        }
      }

      if (validPaths.length === 0) {
        this.log("warn", "No valid watch paths found");
        return;
      }

      this.fileWatcher = chokidar.watch(validPaths, {
        ignored: /^\./, // ignore dotfiles
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100,
        },
      });

      this.fileWatcher.on("add", (filePath) => {
        this.log("info", `Started watching file: ${filePath}`);
        this.watchedFiles.add(filePath);
        this.processFile(filePath);
      });

      this.fileWatcher.on("change", (filePath) => {
        this.log("info", `File changed: ${filePath}`);
        this.processFile(filePath);
      });

      this.fileWatcher.on("unlink", (filePath) => {
        this.log("info", `File removed: ${filePath}`);
        this.watchedFiles.delete(filePath);
        this.lastProcessedTimes.delete(filePath);
      });

      this.fileWatcher.on("error", (error) => {
        this.log("error", "File watcher error", error);
        this.addError(error);
      });

      this.log(
        "info",
        `File watcher setup complete. Watching ${validPaths.length} paths.`
      );
    } catch (error) {
      this.log("error", "Failed to setup file watchers", error);
      throw error;
    }
  }

  async processFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtime.getTime();

      // Check if we've already processed this version of the file
      const lastProcessed = this.lastProcessedTimes.get(filePath);
      if (lastProcessed && lastProcessed >= lastModified) {
        this.log(
          "debug",
          `Skipping ${filePath} - no changes since last processing`
        );
        return;
      }

      this.log("info", `Processing file: ${filePath}`);

      const fileContent = await fs.readFile(filePath, "utf8");
      // Skip empty files
      if (!fileContent.trim()) {
        this.log("warn", `File is empty: ${filePath}`);
        return;
      }

      let data;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        this.log("error", `JSON parse error in ${filePath}`, parseError);
        this.addError(parseError);
        return;
      }
      console.log(data, "pjapifjepjweipajefepi");

      // Convert object format to array format
      const loads = this.convertToLoadArray(data, filePath);

      if (loads.length > 0) {
        await this.sendLoadsToServer(loads);
        this.lastProcessedTimes.set(filePath, lastModified);
        this.stats.totalLoadsProcessed += loads.length;
        this.stats.lastProcessedAt = new Date();
        this.log(
          "info",
          `Successfully processed ${loads.length} loads from ${path.basename(
            filePath
          )}`
        );
      } else {
        this.log("warn", `No valid loads found in ${path.basename(filePath)}`);
      }
    } catch (error) {
      this.log("error", `Error processing file ${filePath}`, error);
      this.addError(error);
    }
  }

  convertToLoadArray(data, filePath) {
    const loads = [];
    const fileName = path.basename(filePath);
    // Handle both object and array formats
    const entries = Array.isArray(data)
      ? data.map((item, index) => [index, item])
      : Object.entries(data);

    for (const [key, load] of entries) {
      try {
        // Normalize load data structure
        const normalizedLoad = {
          hash:
            load.hash || key || `${fileName}-${Date.now()}-${Math.random()}`,
          rate: this.normalizeRate(load.rate),
          origin: this.cleanString(load.origin),
          destination: this.cleanString(load.destination),
          dates: load.dates || load.date,
          company: this.cleanString(load.company),
          contact: this.cleanString(load.contact),
          trip: this.cleanString(load.trip),
          age: load.age,
          dho: parseInt(load.dho) || 0,
          dhd: parseInt(load.dhd) || 0,
          truck: parseInt(load.truck) || 1,
          website: this.cleanString(load.website),
          equipment: this.cleanString(load.equipment),
          clickDetails: this.cleanString(load.clickDetails),
          source: `${fileName}-collector`,
          lastUpdated: new Date().toISOString(),
        };
        console.log(
          "Vlaid load:",
          this.validateLoad(normalizedLoad),
          normalizedLoad
        );
        // Validate required fields
        if (this.validateLoad(normalizedLoad)) {
          loads.push(normalizedLoad);
        }
      } catch (error) {
        this.log("warn", `Error processing individual load ${key}`, error);
      }
    }

    return loads;
  }

  validateLoad(load) {
    const required = ["hash", "origin", "destination", "rate"];
    console.log("Validating load:", load);
    for (const field of required) {
      if (load[field] === undefined || load[field] === null) {
        console.log("Missing required field:", field);
        this.log("warn", `Load missing required field: ${field}`, {
          hash: load.hash,
        });
        return false;
      }
    }
    console.log("Validating rate:", load.rate);

    if (load.rate < 0) {
      this.log("warn", `Load has invalid rate: ${load.rate}`, {
        hash: load.hash,
      });
      return false;
    }
    console.log("Validating truck:", load.truck);
    if (load.truck !== 1 && load.truck !== 2) {
      this.log("warn", `Load has invalid truck: ${load.truck}`, {
        hash: load.hash,
      });
      return false;
    }
    console.log("Validating dates:", load.dates);

    return true;
  }

  cleanString(str) {
    if (!str || typeof str !== "string") return str;
    return str.trim().replace(/\s+/g, " ");
  }

  normalizeRate(rate) {
    if (typeof rate === "string") {
      return parseFloat(rate.replace(/[$,]/g, ""));
    }
    return parseFloat(rate) || 0;
  }

  async sendLoadsToServer(loads) {
    if (!this.isConnected) {
      this.log("warn", "Not connected to server, queuing loads for later...");
      // Could implement a queue here for offline capability
      return false;
    }

    try {
      // Process in batches to avoid overwhelming the server
      const batches = this.chunkArray(loads, this.config.batchSize);

      for (const batch of batches) {
        // Send via WebSocket for real-time updates
        this.socket.emit("load_data", batch);

        // Also send via HTTP API as backup
        await this.sendViaHTTP(batch);

        // Small delay between batches
        if (batches.length > 1) {
          await this.sleep(100);
        }
      }

      return true;
    } catch (error) {
      this.log("error", "Error sending loads to server", error);
      this.addError(error);
      return false;
    }
  }

  async sendViaHTTP(loads) {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/loads/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loads }),
        timeout: 30000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      this.log("debug", "HTTP backup send successful", {
        count: loads.length,
        message: result.message,
      });

      return result;
    } catch (error) {
      this.log("error", "HTTP backup send failed", error);
      throw error;
    }
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  startHeartbeat() {
    setInterval(() => {
      if (this.isConnected) {
        this.socket.emit("heartbeat", {
          timestamp: new Date().toISOString(),
          watchedFiles: Array.from(this.watchedFiles),
          stats: this.getStats(),
          status: "alive",
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  startStatsLogging() {
    setInterval(() => {
      const stats = this.getStats();
      this.log("info", "Collector Stats", stats);
    }, 300000); // Log stats every 5 minutes
  }

  // Manual trigger for immediate file processing
  async processPendingFiles() {
    this.log("info", "Processing all watched files...");
    for (const filePath of this.watchedFiles) {
      await this.processFile(filePath);
    }
  }

  handleConnectionError(error) {
    this.retryCount++;
    this.addError(error);

    if (this.retryCount < this.config.maxRetries) {
      this.log(
        "warn",
        `Retrying connection in ${this.config.retryInterval}ms (attempt ${this.retryCount}/${this.config.maxRetries})`
      );
      setTimeout(() => this.initialize(), this.config.retryInterval);
    } else {
      this.log(
        "error",
        "Max retry attempts reached. Please check your configuration and network connection."
      );
    }
  }

  addError(error) {
    this.stats.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
    });

    // Keep only last 50 errors
    if (this.stats.errors.length > 50) {
      this.stats.errors = this.stats.errors.slice(-50);
    }
  }

  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      connectionId: this.connectionId,
      watchedFiles: Array.from(this.watchedFiles),
      retryCount: this.retryCount,
      uptime: this.stats.connectionTime
        ? Date.now() - this.stats.connectionTime.getTime()
        : 0,
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    console.log(logEntry);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Graceful shutdown
  async shutdown() {
    this.log("info", "Shutting down Load Data Collector...");

    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.log("info", "File watcher closed");
    }

    if (this.socket) {
      this.socket.disconnect();
      this.log("info", "Socket disconnected");
    }

    this.log("info", "Shutdown complete");
    process.exit(0);
  }
}

// CLI Interface
const readline = require("readline");

class CollectorCLI {
  constructor(collector) {
    this.collector = collector;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  showMenu() {
    console.log("\n=== Load Data Collector ===");
    console.log("1. Process files now");
    console.log("2. Show status");
    console.log("3. Show stats");
    console.log("4. Change server URL");
    console.log("5. Add watch path");
    console.log("6. Show recent errors");
    console.log("7. Test connection");
    console.log("8. Exit");
    console.log("\nEnter command (1-8): ");
  }

  async handleCommand(command) {
    switch (command.trim()) {
      case "1":
        console.log("Processing files...");
        await this.collector.processPendingFiles();
        break;

      case "2":
        this.showStatus();
        break;

      case "3":
        this.showStats();
        break;

      case "4":
        this.rl.question("Enter new server URL: ", (url) => {
          this.collector.config.serverUrl = url;
          console.log("Server URL updated. Reconnecting...");
          this.collector.initialize();
          this.showMenu();
        });
        return;

      case "5":
        this.rl.question("Enter path to watch: ", (watchPath) => {
          this.collector.config.watchPaths.push(watchPath);
          console.log("Path added. Reinitializing watchers...");
          this.collector.setupFileWatchers();
          this.showMenu();
        });
        return;

      case "6":
        this.showRecentErrors();
        break;

      case "7":
        await this.testConnection();
        break;

      case "8":
        this.collector.shutdown();
        return;

      default:
        console.log("Invalid command");
    }

    setTimeout(() => this.showMenu(), 1000);
  }

  showStatus() {
    const status = this.collector.getStats();
    console.log("\n--- Status ---");
    console.log(`Connected: ${status.isConnected ? "Yes" : "No"}`);
    console.log(`Connection ID: ${status.connectionId || "None"}`);
    console.log(`Server URL: ${this.collector.config.serverUrl}`);
    console.log(`Watched files: ${status.watchedFiles.length}`);
    status.watchedFiles.forEach((file) => console.log(`  - ${file}`));
    console.log(
      `Uptime: ${status.uptime ? Math.round(status.uptime / 1000) : 0}s`
    );
  }

  showStats() {
    const stats = this.collector.getStats();
    console.log("\n--- Statistics ---");
    console.log(`Total loads processed: ${stats.totalLoadsProcessed}`);
    console.log(`Last processed: ${stats.lastProcessedAt || "Never"}`);
    console.log(`Connection attempts: ${stats.retryCount}`);
    console.log(`Recent errors: ${stats.errors.length}`);
  }

  showRecentErrors() {
    const stats = this.collector.getStats();
    console.log("\n--- Recent Errors ---");
    if (stats.errors.length === 0) {
      console.log("No recent errors");
    } else {
      stats.errors.slice(-5).forEach((error) => {
        console.log(`${error.timestamp}: ${error.message}`);
      });
    }
  }

  async testConnection() {
    console.log("Testing connection...");
    try {
      const response = await fetch(
        `${this.collector.config.serverUrl}/api/health`
      );
      if (response.ok) {
        const health = await response.json();
        console.log("✓ Server is reachable");
        console.log(`Server status: ${health.status}`);
      } else {
        console.log("✗ Server returned error:", response.status);
      }
    } catch (error) {
      console.log("✗ Connection test failed:", error.message);
    }
  }

  start() {
    this.showMenu();
    this.rl.on("line", (input) => this.handleCommand(input));
  }
}

// Main execution
if (require.main === module) {
  const config = {
    serverUrl: process.env.SERVER_URL || "http://localhost:3001",
    watchPaths: process.env.WATCH_PATHS
      ? process.env.WATCH_PATHS.split(",")
      : undefined,
  };

  const collector = new LoadDataCollector(config);
  const cli = new CollectorCLI(collector);

  // Handle process termination
  process.on("SIGINT", () => collector.shutdown());
  process.on("SIGTERM", () => collector.shutdown());

  // Start the application
  async function start() {
    try {
      console.log("Starting Load Data Collector...");
      console.log(`Server URL: ${config.serverUrl}`);
      console.log(`Watch paths: ${collector.config.watchPaths.join(", ")}`);

      await collector.initialize();

      setTimeout(() => {
        cli.start();
      }, 2000);
    } catch (error) {
      console.error("Failed to start collector:", error);
      process.exit(1);
    }
  }

  start();
}

module.exports = { LoadDataCollector, CollectorCLI };
