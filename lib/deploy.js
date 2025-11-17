const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const { createProvider } = require('./providers');
const DockerManager = require('./docker');
const DatabaseManager = require('./database');
const GitManager = require('./git');

/**
 * Main deployment orchestrator
 */
class DeploymentManager {
  constructor(config) {
    this.config = config;
    this.docker = new DockerManager(config);
    this.database = new DatabaseManager(config);
    this.git = new GitManager();
    this.rollbackState = null;
  }

  /**
   * Run full deployment
   */
  async run(options = {}) {
    const spinner = ora('Starting deployment...').start();

    try {
      // Step 1: Validate environment
      spinner.text = 'Validating environment...';
      await this.validateEnvironment();
      spinner.succeed('Environment validated');

      // Step 2: Fetch artifact
      spinner.start('Fetching artifact...');
      const artifact = await this.fetchArtifact();
      spinner.succeed(`Artifact fetched: ${artifact.type}`);

      // Step 3: Initialize database
      spinner.start('Initializing database...');
      await this.database.initialize();
      spinner.succeed('Database initialized');

      // Step 4: Generate Docker files
      spinner.start('Generating Docker configuration...');
      await this.docker.generateDockerfile(artifact.type);
      await this.docker.generateComposeFile(artifact.type);
      spinner.succeed('Docker configuration generated');

      // Step 5: Build Docker image
      spinner.start('Building Docker image...');
      const imageName = `${this.config.name}:latest`;
      await this.docker.buildImage(imageName, path.join(process.cwd(), 'artifacts'));
      spinner.succeed('Docker image built');

      // Step 6: Save rollback state
      this.rollbackState = await this.saveRollbackState();

      // Step 7: Start containers
      spinner.start('Starting containers...');
      await this.docker.startContainers();
      spinner.succeed('Containers started');

      // Step 8: Verify deployment
      spinner.start('Verifying deployment...');
      await this.verifyDeployment();
      spinner.succeed('Deployment verified');

      // Step 9: Git commit (if enabled)
      if (this.config.features?.autoCommit) {
        spinner.start('Creating Git commit...');
        await this.git.commit({
          message: `deploy: ${this.config.name} v${this.getVersion()}`,
          push: this.config.features?.autoDeploy
        });
        spinner.succeed('Git commit created');
      }

      // Success!
      console.log(
        chalk.green.bold('\n✓ Deployment completed successfully!\n')
      );

      this.displayDeploymentInfo();

      return {
        success: true,
        artifact,
        url: `http://${this.config.server.host}:${this.config.server.port}`
      };

    } catch (error) {
      spinner.fail('Deployment failed');
      console.error(chalk.red('\nError:'), error.message);

      // Attempt rollback
      if (this.rollbackState) {
        await this.rollback();
      }

      throw error;
    }
  }

  /**
   * Quick deploy (no UI)
   */
  async quick(configPath) {
    console.log(chalk.cyan.bold('Quick Deploy\n'));

    try {
      const config = require(path.resolve(configPath));
      const deployment = new DeploymentManager(config);
      return await deployment.run();
    } catch (error) {
      console.error(chalk.red('Quick deploy failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Validate deployment environment
   */
  async validateEnvironment() {
    // Check Docker
    await this.docker.checkDocker();

    // Check required environment variables
    const required = ['SESSION_SECRET'];

    if (this.config.auth?.google?.enabled) {
      required.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
    }

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        `Please update your .env file.`
      );
    }

    // Check artifact source exists
    if (this.config.provider === 'local') {
      const sourcePath = path.resolve(this.config.source);
      if (!await fs.pathExists(sourcePath)) {
        throw new Error(`Artifact source not found: ${sourcePath}`);
      }
    }
  }

  /**
   * Fetch artifact from provider
   */
  async fetchArtifact() {
    const provider = await createProvider(this.config);

    await provider.validate();
    const artifact = await provider.fetch();

    // Prepare artifact for deployment
    if (typeof provider.prepare === 'function') {
      await provider.prepare();
    }

    return artifact;
  }

  /**
   * Verify deployment is working
   */
  async verifyDeployment() {
    const axios = require('axios');

    // Wait for containers to be ready
    await this.sleep(5000);

    // Try to connect to the application
    const url = `http://${this.config.server.host}:${this.config.server.port}/health`;

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true // Accept any status
      });

      // If health endpoint exists, check it
      if (response.status === 200) {
        console.log(chalk.green('✓ Health check passed'));
        return true;
      }

      // If no health endpoint, just check if server responds
      if (response.status < 500) {
        console.log(chalk.yellow('⚠ No health endpoint, but server is responding'));
        return true;
      }

      throw new Error(`Server returned status ${response.status}`);

    } catch (error) {
      // If health endpoint doesn't exist, that's okay
      if (error.response?.status === 404) {
        console.log(chalk.gray('No health endpoint found (this is okay)'));
        return true;
      }

      // If ECONNREFUSED, containers might not be ready yet
      if (error.code === 'ECONNREFUSED') {
        console.log(chalk.yellow('⚠ Waiting for containers to be ready...'));
        await this.sleep(5000);
        // Try one more time
        try {
          await axios.get(url.replace('/health', ''), { timeout: 5000 });
          return true;
        } catch (retryError) {
          throw new Error('Containers started but application is not responding');
        }
      }

      throw error;
    }
  }

  /**
   * Save state for potential rollback
   */
  async saveRollbackState() {
    try {
      const status = await this.docker.getContainerStatus();
      return {
        timestamp: Date.now(),
        containers: status,
        commitHash: await this.git.getCurrentCommit()
      };
    } catch (error) {
      console.log(chalk.gray('Could not save rollback state (continuing anyway)'));
      return null;
    }
  }

  /**
   * Rollback deployment
   */
  async rollback() {
    console.log(chalk.yellow('\n⚠ Attempting rollback...'));

    try {
      // Stop current containers
      await this.docker.stopContainers();

      console.log(chalk.green('✓ Rollback completed'));
    } catch (error) {
      console.error(chalk.red('✗ Rollback failed:'), error.message);
    }
  }

  /**
   * Display deployment information
   */
  displayDeploymentInfo() {
    const url = `http://${this.config.server.host}:${this.config.server.port}`;

    console.log(chalk.cyan('Deployment Information:'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('  Project:'), chalk.bold(this.config.name));
    console.log(chalk.white('  URL:'), chalk.blue.underline(url));
    console.log(chalk.white('  Database:'), chalk.bold(this.config.database));
    console.log(chalk.white('  Provider:'), chalk.bold(this.config.provider));

    if (this.config.auth?.google?.enabled) {
      console.log(chalk.white('  OAuth:'), chalk.green('Enabled'));
    }

    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('\nNext steps:'));
    console.log(chalk.gray('  • Visit'), chalk.blue(url), chalk.gray('to see your app'));
    console.log(chalk.gray('  • Check logs:'), chalk.cyan('easy-deploy status'));
    console.log(chalk.gray('  • Stop deployment:'), chalk.cyan('docker-compose down'));
    console.log();
  }

  /**
   * Get version (from package.json or generate)
   */
  getVersion() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = require(packagePath);
        return pkg.version || '1.0.0';
      }
    } catch (error) {
      // Ignore
    }

    return new Date().toISOString().split('T')[0]; // Use date as version
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Quick deploy function (exported for CLI)
 */
async function quick(configPath) {
  const deployment = new DeploymentManager({});
  return await deployment.quick(configPath);
}

/**
 * Main deploy function (exported for CLI)
 */
async function run(options) {
  const configPath = path.resolve(options.config || './easy-deploy.config.js');

  if (!await fs.pathExists(configPath)) {
    console.error(
      chalk.red('Error: Configuration file not found.'),
      '\n',
      chalk.gray('Run'), chalk.cyan('easy-deploy init'), chalk.gray('to create one.')
    );
    process.exit(1);
  }

  const config = require(configPath);
  const deployment = new DeploymentManager(config);

  return await deployment.run(options);
}

module.exports = {
  DeploymentManager,
  quick,
  run
};
