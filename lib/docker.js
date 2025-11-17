const Docker = require('dockerode');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');

/**
 * Docker operations manager
 */
class DockerManager {
  constructor(config) {
    this.config = config;
    this.docker = new Docker();
  }

  /**
   * Check if Docker is running
   */
  async checkDocker() {
    try {
      await this.docker.ping();
      console.log(chalk.green('✓ Docker is running'));
      return true;
    } catch (error) {
      console.error(chalk.red('✗ Docker is not running'));
      throw new Error('Docker daemon is not running. Please start Docker and try again.');
    }
  }

  /**
   * Generate Docker Compose file
   */
  async generateComposeFile(artifactType) {
    console.log(chalk.gray('Generating Docker Compose configuration...'));

    const templatePath = path.join(__dirname, '..', 'templates', 'docker-compose.yml');
    const template = await fs.readFile(templatePath, 'utf-8');

    // Parse and customize based on config
    let compose = yaml.load(template);

    // Customize based on database type
    if (this.config.database === 'sqlite') {
      // Remove PostgreSQL service for SQLite
      delete compose.services.postgres;
    }

    // Save to project directory
    const outputPath = path.join(process.cwd(), 'docker-compose.yml');
    await fs.writeFile(outputPath, yaml.dump(compose, { indent: 2 }));

    console.log(chalk.green('✓ Docker Compose file generated'));
    return outputPath;
  }

  /**
   * Generate Dockerfile
   */
  async generateDockerfile(artifactType) {
    console.log(chalk.gray('Generating Dockerfile...'));

    const templatePath = path.join(__dirname, '..', 'templates', 'Dockerfile');
    const template = await fs.readFile(templatePath, 'utf-8');

    // Customize based on artifact type
    let dockerfile = template;

    switch (artifactType) {
      case 'react':
        dockerfile = this.customizeForReact(template);
        break;
      case 'html':
        dockerfile = this.customizeForHTML(template);
        break;
      case 'next':
        dockerfile = this.customizeForNext(template);
        break;
      default:
        // Use default template
        break;
    }

    // Save to artifacts directory
    const outputPath = path.join(process.cwd(), 'artifacts', 'Dockerfile');
    await fs.writeFile(outputPath, dockerfile);

    console.log(chalk.green('✓ Dockerfile generated'));
    return outputPath;
  }

  /**
   * Customize Dockerfile for React apps
   */
  customizeForReact(template) {
    // React apps typically need build step
    return template.replace(
      '# Build if needed',
      `# Build React app
RUN npm run build`
    );
  }

  /**
   * Customize Dockerfile for static HTML
   */
  customizeForHTML(template) {
    // For static HTML, use nginx
    return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
  }

  /**
   * Customize Dockerfile for Next.js
   */
  customizeForNext(template) {
    return template.replace('npm start', 'npm run start');
  }

  /**
   * Build Docker image
   */
  async buildImage(imageName, contextPath) {
    console.log(chalk.cyan(`Building Docker image: ${imageName}...`));

    try {
      const stream = await this.docker.buildImage(
        {
          context: contextPath,
          src: ['.']
        },
        {
          t: imageName,
          buildargs: {
            NODE_ENV: 'production'
          }
        }
      );

      // Follow build output
      await this.followProgress(stream);

      console.log(chalk.green(`✓ Image built: ${imageName}`));
      return imageName;
    } catch (error) {
      throw new Error(`Failed to build image: ${error.message}`);
    }
  }

  /**
   * Start containers with Docker Compose
   */
  async startContainers() {
    console.log(chalk.cyan('Starting containers...'));

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Use docker-compose command
      const profiles = this.getActiveProfiles();
      const profileArgs = profiles.map(p => `--profile ${p}`).join(' ');

      const cmd = `docker-compose ${profileArgs} up -d`;
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: process.cwd()
      });

      if (stderr && !stderr.includes('WARNING')) {
        console.log(chalk.yellow(stderr));
      }

      console.log(chalk.green('✓ Containers started'));
      return stdout;
    } catch (error) {
      throw new Error(`Failed to start containers: ${error.message}`);
    }
  }

  /**
   * Stop containers
   */
  async stopContainers() {
    console.log(chalk.cyan('Stopping containers...'));

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('docker-compose down', {
        cwd: process.cwd()
      });

      console.log(chalk.green('✓ Containers stopped'));
    } catch (error) {
      throw new Error(`Failed to stop containers: ${error.message}`);
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus() {
    try {
      const containers = await this.docker.listContainers({ all: true });

      // Filter containers for this project
      const projectContainers = containers.filter(container =>
        container.Names.some(name => name.includes(this.config.name))
      );

      return projectContainers.map(container => ({
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        status: container.State,
        uptime: container.Status
      }));
    } catch (error) {
      throw new Error(`Failed to get container status: ${error.message}`);
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerName, tail = 100) {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find(c =>
        c.Names.some(name => name.includes(containerName))
      );

      if (!container) {
        throw new Error(`Container not found: ${containerName}`);
      }

      const containerObj = this.docker.getContainer(container.Id);
      const logs = await containerObj.logs({
        stdout: true,
        stderr: true,
        tail: tail
      });

      return logs.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  /**
   * Get active Docker Compose profiles
   */
  getActiveProfiles() {
    const profiles = [];

    if (this.config.database === 'postgresql') {
      profiles.push('postgres');
    }

    // Add other conditional profiles
    if (this.config.features?.nginx) {
      profiles.push('nginx');
    }

    if (this.config.features?.redis) {
      profiles.push('redis');
    }

    return profiles;
  }

  /**
   * Follow Docker build progress
   */
  async followProgress(stream) {
    return new Promise((resolve, reject) => {
      const onFinished = (err, output) => {
        if (err) {
          reject(err);
        } else {
          resolve(output);
        }
      };

      const onProgress = (event) => {
        if (event.stream) {
          process.stdout.write(chalk.gray(event.stream));
        } else if (event.status) {
          // Show status for image pulls
          if (event.progress) {
            process.stdout.write(
              chalk.gray(`${event.status}: ${event.progress}\r`)
            );
          }
        }
      };

      this.docker.modem.followProgress(stream, onFinished, onProgress);
    });
  }

  /**
   * Prune unused Docker resources
   */
  async pruneResources() {
    console.log(chalk.cyan('Pruning unused Docker resources...'));

    try {
      await this.docker.pruneImages({ filters: { dangling: { true: true } } });
      await this.docker.pruneContainers();
      await this.docker.pruneVolumes();

      console.log(chalk.green('✓ Pruned unused resources'));
    } catch (error) {
      console.error(chalk.yellow('⚠ Failed to prune resources:'), error.message);
    }
  }
}

/**
 * Check deployment status
 */
async function checkStatus(configPath = './easy-deploy.config.js') {
  try {
    const config = require(path.resolve(configPath));
    const dockerManager = new DockerManager(config);

    await dockerManager.checkDocker();

    const status = await dockerManager.getContainerStatus();

    if (status.length === 0) {
      console.log(chalk.yellow('⚠ No containers running'));
      return { running: false, containers: [] };
    }

    console.log(chalk.green(`\n✓ ${status.length} container(s) running:\n`));

    status.forEach(container => {
      const statusColor = container.status === 'running' ? 'green' : 'yellow';
      console.log(
        chalk.gray(`  ${container.id}`) +
        chalk.white(` ${container.name}`) +
        chalk[statusColor](` [${container.status}]`) +
        chalk.gray(` - ${container.uptime}`)
      );
    });

    return { running: true, containers: status };
  } catch (error) {
    console.error(chalk.red('Error checking status:'), error.message);
    return { running: false, error: error.message };
  }
}

module.exports = DockerManager;
module.exports.checkStatus = checkStatus;
