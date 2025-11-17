const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Config Detector
 * Auto-detects project state and configuration status
 */
class ConfigDetector {
  constructor(baseDir = process.cwd()) {
    this.baseDir = baseDir;
    this.state = null;
  }

  /**
   * Detect current project state
   * Returns one of: 'first-launch', 'configured-not-deployed', 'running', 'error'
   */
  async detect() {
    console.log(chalk.gray('Detecting project state...'));

    const checks = {
      configExists: await this.checkConfig(),
      dockerRunning: await this.checkDocker(),
      artifactsExist: await this.checkArtifacts(),
      deploymentRunning: await this.checkDeployment(),
      envValid: await this.checkEnv(),
      databaseExists: await this.checkDatabase()
    };

    // Determine state based on checks
    if (!checks.configExists) {
      this.state = {
        type: 'first-launch',
        checks,
        message: 'No configuration found. Starting setup...',
        suggestions: await this.getFirstLaunchSuggestions()
      };
    } else if (checks.configExists && !checks.deploymentRunning) {
      this.state = {
        type: 'configured-not-deployed',
        checks,
        message: 'Configuration found but not deployed',
        config: this.loadConfig()
      };
    } else if (checks.deploymentRunning) {
      this.state = {
        type: 'running',
        checks,
        message: 'Deployment is running',
        config: this.loadConfig(),
        deployment: await this.getDeploymentInfo()
      };
    }

    // Check for errors
    const errors = this.detectErrors(checks);
    if (errors.length > 0) {
      this.state.type = 'error';
      this.state.errors = errors;
      this.state.fixes = await this.suggestFixes(errors);
    }

    return this.state;
  }

  /**
   * Check if config file exists
   */
  async checkConfig() {
    const configPath = path.join(this.baseDir, 'easy-deploy.config.js');
    return await fs.pathExists(configPath);
  }

  /**
   * Check if Docker is running
   */
  async checkDocker() {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();
      await docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if artifacts directory exists
   */
  async checkArtifacts() {
    const artifactsPath = path.join(this.baseDir, 'artifacts');
    if (!await fs.pathExists(artifactsPath)) {
      return { exists: false, count: 0 };
    }

    const items = await fs.readdir(artifactsPath);
    const artifacts = [];

    for (const item of items) {
      const itemPath = path.join(artifactsPath, item);
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        artifacts.push(item);
      }
    }

    return {
      exists: true,
      count: artifacts.length,
      artifacts
    };
  }

  /**
   * Check if deployment is currently running
   */
  async checkDeployment() {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();
      const containers = await docker.listContainers({ all: true });

      // Check if there are any containers from this project
      const config = this.loadConfig();
      if (!config) return false;

      const projectContainers = containers.filter(container =>
        container.Names.some(name =>
          name.includes(config.name) || name.includes('easy-deploy')
        )
      );

      return projectContainers.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check environment variables
   */
  async checkEnv() {
    const envPath = path.join(this.baseDir, '.env');
    if (!await fs.pathExists(envPath)) {
      return { exists: false, valid: false, missing: [] };
    }

    const config = this.loadConfig();
    if (!config) return { exists: true, valid: true, missing: [] };

    const required = ['SESSION_SECRET'];

    // Check OAuth requirements
    if (config.auth?.google?.enabled) {
      required.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
    }

    // Check database requirements
    if (config.database === 'postgresql') {
      required.push('DATABASE_URL');
    }

    const missing = required.filter(key => !process.env[key]);

    return {
      exists: true,
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Check if database exists
   */
  async checkDatabase() {
    const config = this.loadConfig();
    if (!config) return false;

    if (config.database === 'sqlite') {
      const dbPath = process.env.DATABASE_PATH || path.join(this.baseDir, 'data', 'app.db');
      return await fs.pathExists(dbPath);
    } else if (config.database === 'postgresql') {
      // Would need to actually connect to check
      return !!process.env.DATABASE_URL;
    }

    return false;
  }

  /**
   * Load configuration file
   */
  loadConfig() {
    try {
      const configPath = path.join(this.baseDir, 'easy-deploy.config.js');
      if (fs.existsSync(configPath)) {
        // Clear cache to get fresh config
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
      }
    } catch (error) {
      console.error(chalk.red('Error loading config:'), error.message);
    }
    return null;
  }

  /**
   * Detect errors in current state
   */
  detectErrors(checks) {
    const errors = [];

    if (!checks.dockerRunning) {
      errors.push({
        type: 'docker-not-running',
        severity: 'critical',
        message: 'Docker is not running',
        description: 'Docker Desktop needs to be started before deployment'
      });
    }

    if (!checks.envValid?.valid && checks.envValid?.missing.length > 0) {
      errors.push({
        type: 'missing-env-vars',
        severity: 'high',
        message: `Missing environment variables: ${checks.envValid.missing.join(', ')}`,
        description: 'Required environment variables are not set in .env file'
      });
    }

    const config = this.loadConfig();
    if (config && config.source) {
      const sourcePath = path.resolve(this.baseDir, config.source);
      if (!fs.existsSync(sourcePath)) {
        errors.push({
          type: 'source-not-found',
          severity: 'high',
          message: `Source not found: ${config.source}`,
          description: 'The configured artifact source directory does not exist'
        });
      }
    }

    return errors;
  }

  /**
   * Suggest fixes for detected errors
   */
  async suggestFixes(errors) {
    const fixes = [];

    for (const error of errors) {
      switch (error.type) {
        case 'docker-not-running':
          fixes.push({
            error: error.type,
            action: 'start-docker',
            description: 'Start Docker Desktop',
            autoFixable: false,
            instructions: [
              'Open Docker Desktop application',
              'Wait for Docker to start',
              'Retry deployment'
            ]
          });
          break;

        case 'missing-env-vars':
          fixes.push({
            error: error.type,
            action: 'update-env',
            description: 'Update .env file with missing variables',
            autoFixable: true,
            instructions: [
              'Edit .env file',
              'Add missing variables',
              'Restart application'
            ]
          });
          break;

        case 'source-not-found':
          fixes.push({
            error: error.type,
            action: 'update-source',
            description: 'Update source path or create artifacts directory',
            autoFixable: true,
            instructions: [
              'Check artifact source path in config',
              'Create artifacts directory if needed',
              'Add your application files'
            ]
          });
          break;
      }
    }

    return fixes;
  }

  /**
   * Get suggestions for first launch
   */
  async getFirstLaunchSuggestions() {
    const suggestions = [];

    // Check for package.json
    const packageJsonPath = path.join(this.baseDir, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      suggestions.push({
        type: 'nodejs-project',
        message: 'Node.js project detected',
        action: 'Can set up as Node.js application'
      });
    }

    // Check for artifacts
    const artifactsPath = path.join(this.baseDir, 'artifacts');
    if (await fs.pathExists(artifactsPath)) {
      const items = await fs.readdir(artifactsPath);
      const dirs = [];
      for (const item of items) {
        const stats = await fs.stat(path.join(artifactsPath, item));
        if (stats.isDirectory()) dirs.push(item);
      }
      if (dirs.length > 0) {
        suggestions.push({
          type: 'artifacts-found',
          message: `Found ${dirs.length} artifact(s)`,
          artifacts: dirs,
          action: 'Can auto-deploy these artifacts'
        });
      }
    }

    return suggestions;
  }

  /**
   * Get deployment information
   */
  async getDeploymentInfo() {
    try {
      const config = this.loadConfig();
      const Docker = require('dockerode');
      const docker = new Docker();
      const containers = await docker.listContainers();

      const projectContainers = containers.filter(container =>
        container.Names.some(name => name.includes(config.name))
      );

      return {
        containerCount: projectContainers.length,
        containers: projectContainers.map(c => ({
          id: c.Id.substring(0, 12),
          name: c.Names[0].replace('/', ''),
          status: c.State,
          uptime: c.Status
        })),
        url: `http://${config.server?.host || 'localhost'}:${config.server?.port || 3000}`
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get summary for display
   */
  getSummary() {
    if (!this.state) {
      return 'State not detected yet';
    }

    const { type, checks, message } = this.state;

    return {
      state: type,
      message,
      config: checks.configExists ? '✓' : '✗',
      docker: checks.dockerRunning ? '✓' : '✗',
      artifacts: checks.artifactsExist?.exists ? `✓ (${checks.artifactsExist.count})` : '✗',
      deployment: checks.deploymentRunning ? '✓' : '✗',
      environment: checks.envValid?.valid ? '✓' : '⚠',
      database: checks.databaseExists ? '✓' : '✗'
    };
  }
}

module.exports = ConfigDetector;
