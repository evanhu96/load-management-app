
// =====================================
// backend/src/middleware/errorHandler.js
// =====================================

const { logger } = require('../utils/logger');

class ErrorHandler {
  static handle(err, req, res, next) {
    // Log the error
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Database errors
    if (err.code && err.code.startsWith('SQLITE_')) {
      return this.handleDatabaseError(err, res);
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: err.message
      });
    }

    // File system errors
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        error: 'File not found'
      });
    }

    if (err.code === 'EACCES') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: 'Invalid JSON format'
      });
    }

    // Default error response
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      error: isDevelopment ? err.message : 'Internal server error',
      ...(isDevelopment && { stack: err.stack })
    });
  }

  static handleDatabaseError(err, res) {
    switch (err.code) {
      case 'SQLITE_CONSTRAINT_UNIQUE':
        return res.status(409).json({
          error: 'Resource already exists',
          details: 'A record with this identifier already exists'
        });
      
      case 'SQLITE_CONSTRAINT_FOREIGN':
        return res.status(400).json({
          error: 'Invalid reference',
          details: 'Referenced record does not exist'
        });
      
      case 'SQLITE_CONSTRAINT_CHECK':
        return res.status(400).json({
          error: 'Invalid data',
          details: 'Data does not meet requirements'
        });
      
      case 'SQLITE_BUSY':
        return res.status(503).json({
          error: 'Database busy',
          details: 'Please try again later'
        });
      
      case 'SQLITE_LOCKED':
        return res.status(503).json({
          error: 'Database locked',
          details: 'Please try again later'
        });
      
      default:
        return res.status(500).json({
          error: 'Database error',
          details: process.env.NODE_ENV === 'development' ? err.message : 'Database operation failed'
        });
    }
  }

  static notFound(req, res) {
    res.status(404).json({
      error: 'Route not found',
      path: req.originalUrl,
      method: req.method
    });
  }

  static methodNotAllowed(allowedMethods) {
    return (req, res) => {
      res.set('Allow', allowedMethods.join(', '));
      res.status(405).json({
        error: 'Method not allowed',
        allowedMethods
      });
    };
  }
}

module.exports = { ErrorHandler };