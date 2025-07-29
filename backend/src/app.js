// backend/src/app.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

const { database, initializeDatabase } = require("./utils/database");
const { logger } = require("./utils/logger");
const socketHandler = require("./websocket/socketHandler");

// Import routes
const loadRoutes = require("./routes/loads");
const configRoutes = require("./routes/config");
const alertRoutes = require("./routes/alerts");
const dispatchInputsRoutes = require('./routes/dispatchInputs');

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGTERM', (signal) => {
  console.error('RECEIVED SIGTERM:', signal);
  console.error('Stack trace:', new Error().stack);
  console.error('Process uptime:', process.uptime());
  console.error('Memory usage:', process.memoryUsage());
});

process.on('SIGINT', (signal) => {
  console.error('RECEIVED SIGINT:', signal);
});

process.on('exit', (code) => {
  console.error('PROCESS EXITING with code:', code);
});

process.on('beforeExit', (code) => {
  console.error('BEFORE EXIT with code:', code);
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Debug logging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Make io available to routes
app.set("io", io);

// Health check routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'load-management-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes - MUST COME BEFORE ERROR HANDLERS
app.use("/api/loads", loadRoutes);
app.use("/api", configRoutes);
app.use("/api/alerts", alertRoutes);
app.use('/api/dispatch-inputs', dispatchInputsRoutes);

console.log('✅ All routes registered successfully');

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// 404 handler - MUST BE LAST
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// WebSocket handling
socketHandler(io);

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database init complete');
    
    const PORT = process.env.PORT || 3001;
    console.log('Railway PORT env var:', process.env.PORT);
    console.log('Using PORT:', PORT);
    
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on 0.0.0.0:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      
      // Test internal connectivity
      setTimeout(() => {
        fetch(`http://localhost:${PORT}/health`)
          .then(r => r.json())
          .then(data => console.log('Internal health check:', data))
          .catch(e => console.log('Internal health check failed:', e.message));
      }, 1000);
    });
    
    console.log('Server setup complete');
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    database.close();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    database.close();
    process.exit(0);
  });
});

startServer();

module.exports = app;