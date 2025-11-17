const express = require('express');
const router = express.Router();
const os = require('os');

/**
 * Health check endpoint
 * Used by Docker health checks and monitoring
 */
router.get('/', (req, res) => {
  const healthcheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      system: Math.round(os.totalmem() / 1024 / 1024)
    },
    cpu: {
      load: os.loadavg(),
      cores: os.cpus().length
    }
  };

  res.status(200).json(healthcheck);
});

module.exports = router;
