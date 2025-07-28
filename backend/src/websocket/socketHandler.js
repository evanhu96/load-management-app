const { logger } = require('../utils/logger');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const clientInfo = {
      id: socket.id,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      type: null // 'frontend' or 'remote-client'
    };

    this.connectedClients.set(socket.id, clientInfo);
    
    logger.info('Client connected', {
      socketId: socket.id,
      totalClients: this.connectedClients.size
    });

    // Handle client identification
    socket.on('identify', (data) => {
      clientInfo.type = data.type;
      clientInfo.version = data.version;
      logger.info('Client identified', { socketId: socket.id, type: data.type });
    });

    // Handle heartbeat
    socket.on('heartbeat', (data) => {
      clientInfo.lastActivity = new Date().toISOString();
      socket.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
    });

    // Handle load data from remote clients
    socket.on('load_data', (data) => {
      logger.info('Received load data', { 
        socketId: socket.id, 
        loadCount: Array.isArray(data) ? data.length : 1 
      });
      
      // Broadcast to all other clients
      socket.broadcast.emit('load_data_received', data);
    });

    // Handle manual refresh requests
    socket.on('request_refresh', () => {
      logger.info('Refresh requested', { socketId: socket.id });
      this.io.emit('refresh_requested');
    });

    // Handle configuration updates
    socket.on('config_update', (data) => {
      logger.info('Configuration updated', { socketId: socket.id, truckId: data.truckId });
      socket.broadcast.emit('config_updated', data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.connectedClients.delete(socket.id);
      logger.info('Client disconnected', {
        socketId: socket.id,
        reason,
        totalClients: this.connectedClients.size
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, error });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Load Management Server',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
  }

  // Broadcast to all clients
  broadcast(event, data) {
    this.io.emit(event, data);
    logger.debug('Broadcasted event', { event, clientCount: this.connectedClients.size });
  }

  // Broadcast to specific client types
  broadcastToType(type, event, data) {
    const clients = Array.from(this.connectedClients.values())
      .filter(client => client.type === type);
    
    clients.forEach(client => {
      this.io.to(client.id).emit(event, data);
    });
    
    logger.debug('Broadcasted to client type', { type, event, clientCount: clients.length });
  }

  // Get connection stats
  getStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      frontendClients: 0,
      remoteClients: 0,
      unknownClients: 0
    };

    this.connectedClients.forEach(client => {
      switch (client.type) {
        case 'frontend':
          stats.frontendClients++;
          break;
        case 'remote-client':
          stats.remoteClients++;
          break;
        default:
          stats.unknownClients++;
      }
    });

    return stats;
  }
}

module.exports = (io) => {
  return new SocketHandler(io);
};