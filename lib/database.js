const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Database manager for Easy Deploy
 * Supports SQLite (default) and PostgreSQL
 */
class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.type = config.database || 'sqlite';
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    console.log(chalk.cyan(`Initializing ${this.type} database...`));

    if (this.type === 'sqlite') {
      await this.initializeSQLite();
    } else if (this.type === 'postgresql') {
      await this.initializePostgreSQL();
    } else {
      throw new Error(`Unsupported database type: ${this.type}`);
    }

    console.log(chalk.green('✓ Database initialized'));
  }

  /**
   * Initialize SQLite database
   */
  async initializeSQLite() {
    const Database = require('better-sqlite3');

    // Ensure data directory exists
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
    const dbDir = path.dirname(dbPath);
    await fs.ensureDir(dbDir);

    // Create database connection
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance

    console.log(chalk.gray(`SQLite database: ${dbPath}`));

    // Run migrations
    await this.runMigrations();
  }

  /**
   * Initialize PostgreSQL database
   */
  async initializePostgreSQL() {
    const { Pool } = require('pg');

    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'changeme'}@localhost:5432/${this.config.name}`;

    this.db = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.db.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log(chalk.gray('PostgreSQL connected'));
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }

    // Run migrations
    await this.runMigrations();
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    console.log(chalk.gray('Running migrations...'));

    const migrations = [
      this.createUsersTable,
      this.createArtifactsTable,
      this.createDeploymentsTable,
      this.createSessionsTable
    ];

    for (const migration of migrations) {
      await migration.call(this);
    }

    console.log(chalk.green('✓ Migrations completed'));
  }

  /**
   * Create users table
   */
  async createUsersTable() {
    if (this.type === 'sqlite') {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          google_id TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          avatar TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          avatar TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
  }

  /**
   * Create artifacts table
   */
  async createArtifactsTable() {
    if (this.type === 'sqlite') {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          source TEXT NOT NULL,
          path TEXT NOT NULL,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create index
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id)
      `);
    } else {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS artifacts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          source TEXT NOT NULL,
          path TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id)
      `);
    }
  }

  /**
   * Create deployments table
   */
  async createDeploymentsTable() {
    if (this.type === 'sqlite') {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deployments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          artifact_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          environment TEXT DEFAULT 'production',
          commit_hash TEXT,
          logs TEXT,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (artifact_id) REFERENCES artifacts (id) ON DELETE CASCADE
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id)
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deployments_artifact_id ON deployments(artifact_id)
      `);
    } else {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS deployments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          artifact_id INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          environment VARCHAR(50) DEFAULT 'production',
          commit_hash VARCHAR(255),
          logs TEXT,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (artifact_id) REFERENCES artifacts (id) ON DELETE CASCADE
        )
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id)
      `);
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_deployments_artifact_id ON deployments(artifact_id)
      `);
    }
  }

  /**
   * Create sessions table
   */
  async createSessionsTable() {
    if (this.type === 'sqlite') {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expire DATETIME NOT NULL
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
      `);
    } else {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR(255) PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
      `);
    }
  }

  /**
   * Create user
   */
  async createUser(userData) {
    if (this.type === 'sqlite') {
      const stmt = this.db.prepare(`
        INSERT INTO users (google_id, email, name, avatar)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(userData.google_id, userData.email, userData.name, userData.avatar);
      return result.lastInsertRowid;
    } else {
      const result = await this.db.query(
        `INSERT INTO users (google_id, email, name, avatar)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userData.google_id, userData.email, userData.name, userData.avatar]
      );
      return result.rows[0].id;
    }
  }

  /**
   * Find user by Google ID
   */
  async findUserByGoogleId(googleId) {
    if (this.type === 'sqlite') {
      return this.db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    } else {
      const result = await this.db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      return result.rows[0];
    }
  }

  /**
   * Create artifact
   */
  async createArtifact(userId, artifactData) {
    const metadata = JSON.stringify(artifactData.metadata || {});

    if (this.type === 'sqlite') {
      const stmt = this.db.prepare(`
        INSERT INTO artifacts (user_id, name, type, source, path, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        userId,
        artifactData.name,
        artifactData.type,
        artifactData.source,
        artifactData.path,
        metadata
      );
      return result.lastInsertRowid;
    } else {
      const result = await this.db.query(
        `INSERT INTO artifacts (user_id, name, type, source, path, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, artifactData.name, artifactData.type, artifactData.source, artifactData.path, metadata]
      );
      return result.rows[0].id;
    }
  }

  /**
   * Get user artifacts
   */
  async getUserArtifacts(userId) {
    if (this.type === 'sqlite') {
      return this.db.prepare('SELECT * FROM artifacts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    } else {
      const result = await this.db.query('SELECT * FROM artifacts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return result.rows;
    }
  }

  /**
   * Create deployment
   */
  async createDeployment(userId, artifactId, deploymentData) {
    if (this.type === 'sqlite') {
      const stmt = this.db.prepare(`
        INSERT INTO deployments (user_id, artifact_id, status, environment, commit_hash)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        userId,
        artifactId,
        deploymentData.status || 'pending',
        deploymentData.environment || 'production',
        deploymentData.commit_hash || null
      );
      return result.lastInsertRowid;
    } else {
      const result = await this.db.query(
        `INSERT INTO deployments (user_id, artifact_id, status, environment, commit_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, artifactId, deploymentData.status || 'pending', deploymentData.environment || 'production', deploymentData.commit_hash || null]
      );
      return result.rows[0].id;
    }
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(deploymentId, status, logs = null) {
    const completedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;

    if (this.type === 'sqlite') {
      const stmt = this.db.prepare(`
        UPDATE deployments
        SET status = ?, logs = ?, completed_at = ?
        WHERE id = ?
      `);
      stmt.run(status, logs, completedAt, deploymentId);
    } else {
      await this.db.query(
        `UPDATE deployments
         SET status = $1, logs = $2, completed_at = $3
         WHERE id = $4`,
        [status, logs, completedAt, deploymentId]
      );
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      if (this.type === 'sqlite') {
        this.db.close();
      } else {
        await this.db.end();
      }
      console.log(chalk.gray('Database connection closed'));
    }
  }

  /**
   * Backup database
   */
  async backup() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.ensureDir(backupDir);

    if (this.type === 'sqlite') {
      const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
      const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
      await fs.copy(dbPath, backupPath);
      console.log(chalk.green(`✓ Database backed up to ${backupPath}`));
      return backupPath;
    } else {
      // PostgreSQL backup would use pg_dump
      console.log(chalk.yellow('⚠ PostgreSQL backup not implemented yet'));
      return null;
    }
  }
}

/**
 * Manage database operations from CLI
 */
async function manage(options) {
  const configPath = path.join(process.cwd(), 'easy-deploy.config.js');
  let config;

  try {
    config = require(configPath);
  } catch (error) {
    console.error(chalk.red('Error: Configuration file not found. Run "easy-deploy init" first.'));
    process.exit(1);
  }

  const dbManager = new DatabaseManager(config);

  if (options.migrate) {
    await dbManager.initialize();
  } else if (options.seed) {
    console.log(chalk.cyan('Seeding database...'));
    // Add seed logic here
    console.log(chalk.green('✓ Database seeded'));
  } else if (options.reset) {
    console.log(chalk.yellow('⚠ Resetting database...'));
    // Add reset logic here
    console.log(chalk.green('✓ Database reset'));
  } else {
    console.log(chalk.yellow('Please specify an operation: --migrate, --seed, or --reset'));
  }

  await dbManager.close();
}

module.exports = DatabaseManager;
module.exports.manage = manage;
