// Add this at the very top of app.js
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
// Add at the very top of app.js
process.on('SIGTERM', (signal) => {
  console.error('RECEIVED SIGTERM:', signal);
  console.error('Stack trace:', new Error().stack);
  console.error('Process uptime:', process.uptime());
  console.error('Memory usage:', process.memoryUsage());
  // Don't exit - let's see what happens
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

const { database, initializeDatabase } = require("./utils/database");
const { logger } = require("./utils/logger"); // ← This should be line 12
const socketHandler = require("./websocket/socketHandler");
// backend/src/app.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

// Import routes
const loadRoutes = require("./routes/loads");
const configRoutes = require("./routes/config");
const alertRoutes = require("./routes/alerts");
const dispatchInputsRoutes = require('./routes/dispatchInputs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});
// In backend/src/app.js, add this with your other route imports:


// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Make io available to routes
app.set("io", io);

// Routes
app.use("/api/loads", loadRoutes);
app.use("/api", configRoutes);
app.use("/api/alerts", alertRoutes);
// Then add this with your other app.use statements:
app.use('/api/dispatch-inputs', dispatchInputsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
// Make sure this is in your app.js
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'load-management-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});
// Add this right after your middleware setup
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});
// Add this right after your other route imports in app.js:
// try {
//   const dispatchInputsRoutes = require('./routes/dispatchInputs');
//   app.use('/api/dispatch-inputs', dispatchInputsRoutes);
//   console.log('✅ Dispatch inputs routes loaded successfully');
// } catch (error) {
//   console.error('❌ Error loading dispatch inputs routes:', error.message);
// }
// WebSocket handling
socketHandler(io);

// Initialize database and start server
// Wrap your entire startServer in try/catch
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
