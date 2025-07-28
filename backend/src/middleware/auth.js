
// =====================================
// backend/src/middleware/auth.js
// =====================================

const { logger } = require('../utils/logger');

const authMiddleware = {
  // Basic API key authentication (you can enhance this)
  requireApiKey: (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const validApiKey = process.env.API_KEY;
    
    if (!validApiKey) {
      // If no API key is configured, skip authentication
      return next();
    }
    
    if (!apiKey || apiKey !== validApiKey) {
      logger.warn('Invalid API key attempt', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        providedKey: apiKey ? 'PROVIDED' : 'MISSING'
      });
      
      return res.status(401).json({
        error: 'Invalid or missing API key'
      });
    }
    
    next();
  },

  // Rate limiting middleware
  rateLimiter: (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old requests
      if (requests.has(clientId)) {
        const clientRequests = requests.get(clientId).filter(time => time > windowStart);
        requests.set(clientId, clientRequests);
      } else {
        requests.set(clientId, []);
      }
      
      const clientRequests = requests.get(clientId);
      
      if (clientRequests.length >= maxRequests) {
        logger.warn('Rate limit exceeded', { ip: req.ip, requests: clientRequests.length });
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      clientRequests.push(now);
      next();
    };
  },

  // CORS middleware for specific origins
  corsMiddleware: (req, res, next) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001'];
    
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  }
};

module.exports = { authMiddleware };
