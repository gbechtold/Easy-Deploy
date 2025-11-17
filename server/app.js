require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'easy-deploy-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Logging middleware
app.use(require('./middleware/logging'));

// Static files - serve from artifacts or public
const artifactsPath = path.join(process.cwd(), 'artifacts');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(artifactsPath)) {
  app.use('/app', express.static(artifactsPath));
}
app.use(express.static(publicPath));

// Health check endpoint (for Docker health checks)
app.use('/health', require('./routes/health'));

// Authentication routes (if OAuth enabled)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const passport = require('passport');
  const auth = require('../lib/auth');
  const DatabaseManager = require('../lib/database');

  // Load config if it exists
  let config = { database: process.env.DATABASE_TYPE || 'sqlite' };
  const configPath = path.join(process.cwd(), 'easy-deploy.config.js');
  if (fs.existsSync(configPath)) {
    config = require(configPath);
  }

  const dbManager = new DatabaseManager(config);

  // Configure authentication
  auth.configureAuth(app, dbManager);
  auth.setupAuthRoutes(app);

  console.log('✓ OAuth authentication enabled');
}

// API Routes
app.use('/api/artifacts', require('./routes/artifacts'));
app.use('/api/deployments', require('./routes/deployments'));
app.use('/api/status', require('./routes/status'));

// Main route - serve the artifact or default page
app.get('/', (req, res) => {
  // Try to serve index.html from artifacts
  const indexPaths = [
    path.join(artifactsPath, 'index.html'),
    path.join(artifactsPath, 'build', 'index.html'),
    path.join(artifactsPath, 'dist', 'index.html'),
    path.join(publicPath, 'index.html')
  ];

  for (const indexPath of indexPaths) {
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  // No artifact found, show default page
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Easy Deploy - Running</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
          max-width: 600px;
        }
        h1 { margin: 0 0 1rem 0; font-size: 3rem; }
        p { margin: 0.5rem 0; font-size: 1.2rem; opacity: 0.9; }
        .status {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.2);
          border-radius: 20px;
          margin: 1rem 0;
        }
        .links {
          margin-top: 2rem;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        a {
          color: white;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.2);
          border-radius: 8px;
          transition: background 0.3s;
        }
        a:hover {
          background: rgba(255,255,255,0.3);
        }
        .info {
          margin-top: 2rem;
          font-size: 0.9rem;
          opacity: 0.7;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Easy Deploy</h1>
        <div class="status">● Running</div>
        <p>Your application is deployed and running!</p>
        <p>No artifact found in /artifacts directory.</p>
        <div class="links">
          <a href="/health">Health Check</a>
          <a href="/api/status">API Status</a>
        </div>
        <div class="info">
          <p>Deploy an artifact using:</p>
          <code>easy-deploy add-artifact --source ./your-app</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Error handling middleware (must be last)
app.use(require('./middleware/error'));

// Start server
const PORT = process.env.SERVER_PORT || 3000;
const HOST = process.env.SERVER_HOST || 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Easy Deploy Server                                        ║
╟────────────────────────────────────────────────────────────╢
║  Status:     ● Running                                     ║
║  URL:        http://${HOST}:${PORT}                        ║
║  Health:     http://${HOST}:${PORT}/health                 ║
║  API:        http://${HOST}:${PORT}/api                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
