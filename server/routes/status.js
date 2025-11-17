const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Status endpoint
 * Returns deployment and configuration status
 */
router.get('/', (req, res) => {
  const configPath = path.join(process.cwd(), 'easy-deploy.config.js');
  let config = null;

  if (fs.existsSync(configPath)) {
    try {
      config = require(configPath);
    } catch (error) {
      // Config exists but couldn't load
    }
  }

  const status = {
    deployed: true,
    configured: config !== null,
    timestamp: new Date().toISOString(),
    config: config ? {
      name: config.name,
      provider: config.provider,
      database: config.database,
      workflow: config.workflow
    } : null,
    server: {
      port: process.env.SERVER_PORT || 3000,
      host: process.env.SERVER_HOST || 'localhost',
      nodeVersion: process.version
    },
    artifacts: {
      path: './artifacts',
      exists: fs.existsSync(path.join(process.cwd(), 'artifacts'))
    }
  };

  res.json(status);
});

module.exports = router;
