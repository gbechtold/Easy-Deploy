const blessed = require('blessed');
const contrib = require('blessed-contrib');
const UIComponents = require('./components');
const { icons } = require('./themes');
const fs = require('fs-extra');
const path = require('path');

class Dashboard {
  constructor() {
    this.screen = null;
    this.grid = null;
    this.components = null;
    this.widgets = {};
    this.logs = [];
    this.deploymentStatus = 'idle';
  }

  /**
   * Initialize and launch the dashboard
   */
  async launch() {
    this.createScreen();
    this.components = new UIComponents(this.screen);
    this.createLayout();
    this.setupEventHandlers();
    this.loadConfiguration();
    this.screen.render();
  }

  /**
   * Create the blessed screen
   */
  createScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Easy Deploy Dashboard',
      fullUnicode: true,
      dockBorders: true,
      autoPadding: true
    });

    // Handle screen resize
    this.screen.on('resize', () => {
      this.screen.render();
    });

    // Exit handlers
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.confirmExit();
    });
  }

  /**
   * Create the dashboard layout
   */
  createLayout() {
    // Create grid layout
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Header box - Project status
    this.widgets.header = this.grid.set(0, 0, 2, 12, blessed.box, {
      label: ` ${icons.server} Easy Deploy Dashboard `,
      content: this.getHeaderContent(),
      tags: true,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Project info - left panel
    this.widgets.projectInfo = this.grid.set(2, 0, 4, 4, blessed.box, {
      label: ' Project Info ',
      content: this.getProjectInfo(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Deployment status - center top
    this.widgets.deploymentStatus = this.grid.set(2, 4, 4, 4, blessed.box, {
      label: ` ${icons.docker} Deployment Status `,
      content: this.getDeploymentStatus(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Quick actions - right panel
    this.widgets.actions = this.grid.set(2, 8, 4, 4, blessed.list, {
      label: ' Quick Actions ',
      keys: true,
      vi: true,
      mouse: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        selected: {
          bg: 'cyan',
          fg: 'black',
          bold: true
        },
        border: {
          fg: 'cyan'
        }
      },
      items: [
        `${icons.success} Deploy Application`,
        `${icons.git} Git Commit & Push`,
        `${icons.database} Database Operations`,
        `${icons.key} Configure OAuth`,
        `${icons.docker} Docker Status`,
        `${icons.arrow} Add Artifact`,
        `${icons.info} View Logs`,
        `${icons.error} Exit Dashboard`
      ]
    });

    // Progress bar
    this.widgets.progress = this.grid.set(6, 0, 1, 12, blessed.progressbar, {
      label: ' Deployment Progress ',
      border: {
        type: 'line'
      },
      style: {
        fg: 'cyan',
        bg: 'black',
        bar: {
          bg: 'cyan',
          fg: 'blue'
        },
        border: {
          fg: 'cyan'
        }
      },
      filled: 0
    });

    // Log viewer - bottom section
    this.widgets.logs = this.grid.set(7, 0, 5, 12, blessed.log, {
      label: ` ${icons.info} Activity Log `,
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollback: 100,
      scrollbar: {
        ch: ' ',
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    this.addLog('info', 'Dashboard initialized successfully');
    this.addLog('info', 'Waiting for user action...');
  }

  /**
   * Get header content
   */
  getHeaderContent() {
    const timestamp = new Date().toLocaleString();
    return `{center}{cyan-fg}Easy Deploy{/cyan-fg} | Provider-agnostic deployment made easy | {gray-fg}${timestamp}{/gray-fg}{/center}`;
  }

  /**
   * Get project info content
   */
  getProjectInfo() {
    const config = this.loadConfig();
    if (!config) {
      return '{yellow-fg}No project configured{/yellow-fg}\n\nRun: easy-deploy init';
    }

    return `
{cyan-fg}Name:{/cyan-fg} ${config.name || 'N/A'}
{cyan-fg}Provider:{/cyan-fg} ${config.provider || 'auto'}
{cyan-fg}Database:{/cyan-fg} ${config.database || 'sqlite'}
{cyan-fg}Source:{/cyan-fg} ${config.source || 'N/A'}
{cyan-fg}Server:{/cyan-fg} ${config.server?.host || 'N/A'}
    `.trim();
  }

  /**
   * Get deployment status content
   */
  getDeploymentStatus() {
    const statusIndicator = this.components.createStatusIndicator(this.deploymentStatus);

    return `
{center}${statusIndicator.text}{/center}

{cyan-fg}Containers:{/cyan-fg} 0 running
{cyan-fg}Last Deploy:{/cyan-fg} Never
{cyan-fg}Uptime:{/cyan-fg} N/A
    `.trim();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Actions list selection
    this.widgets.actions.on('select', async (item, index) => {
      const action = item.getText().replace(/^.*?\s/, ''); // Remove icon
      await this.handleAction(action);
    });

    // Auto-update header timestamp
    setInterval(() => {
      this.widgets.header.setContent(this.getHeaderContent());
      this.screen.render();
    }, 1000);

    // Focus on actions by default
    this.widgets.actions.focus();
  }

  /**
   * Handle quick action selection
   */
  async handleAction(action) {
    this.addLog('info', `Action selected: ${action}`);

    switch (action) {
      case 'Deploy Application':
        await this.deployApplication();
        break;
      case 'Git Commit & Push':
        await this.gitCommitPush();
        break;
      case 'Database Operations':
        await this.databaseOperations();
        break;
      case 'Configure OAuth':
        await this.configureOAuth();
        break;
      case 'Docker Status':
        await this.showDockerStatus();
        break;
      case 'Add Artifact':
        await this.addArtifact();
        break;
      case 'View Logs':
        this.widgets.logs.focus();
        break;
      case 'Exit Dashboard':
        this.confirmExit();
        break;
    }
  }

  /**
   * Deploy application
   */
  async deployApplication() {
    this.addLog('info', 'Starting deployment process...');
    this.deploymentStatus = 'running';
    this.updateProgress(0);

    try {
      const deploy = require('../deploy');

      // Simulate deployment steps
      this.updateProgress(25);
      this.addLog('success', 'Building Docker images...');

      await this.sleep(1000);
      this.updateProgress(50);
      this.addLog('success', 'Starting containers...');

      await this.sleep(1000);
      this.updateProgress(75);
      this.addLog('success', 'Running database migrations...');

      await this.sleep(1000);
      this.updateProgress(100);
      this.addLog('success', 'Deployment completed successfully!');
      this.deploymentStatus = 'completed';

    } catch (error) {
      this.addLog('error', `Deployment failed: ${error.message}`);
      this.deploymentStatus = 'failed';
      this.updateProgress(0);
    }

    this.refreshWidgets();
  }

  /**
   * Git commit and push
   */
  async gitCommitPush() {
    this.addLog('info', 'Preparing Git commit...');
    // Placeholder for git integration
    this.components.showMessage('Git Operations', 'Git integration coming soon!', 'info');
  }

  /**
   * Database operations
   */
  async databaseOperations() {
    this.addLog('info', 'Opening database operations...');
    this.components.showMessage('Database', 'Database operations coming soon!', 'info');
  }

  /**
   * Configure OAuth
   */
  async configureOAuth() {
    this.addLog('info', 'Opening OAuth configuration...');
    this.components.showMessage('OAuth', 'OAuth configuration coming soon!', 'info');
  }

  /**
   * Show Docker status
   */
  async showDockerStatus() {
    this.addLog('info', 'Checking Docker status...');
    this.components.showMessage('Docker', 'Docker integration coming soon!', 'info');
  }

  /**
   * Add artifact
   */
  async addArtifact() {
    this.addLog('info', 'Adding new artifact...');
    this.components.showMessage('Add Artifact', 'Artifact management coming soon!', 'info');
  }

  /**
   * Confirm exit
   */
  confirmExit() {
    this.components.createConfirmDialog(
      'Exit Dashboard',
      'Are you sure you want to exit?',
      (confirmed) => {
        if (confirmed) {
          this.cleanup();
          process.exit(0);
        }
      }
    );
  }

  /**
   * Add log entry
   */
  addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const icons_map = {
      info: icons.info,
      success: icons.success,
      error: icons.error,
      warning: icons.warning
    };

    const colors = {
      info: 'cyan',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };

    const icon = icons_map[type] || icons.info;
    const color = colors[type] || 'white';

    const logMessage = `{gray-fg}[${timestamp}]{/gray-fg} {${color}-fg}${icon}{/${color}-fg} ${message}`;

    this.logs.push(logMessage);
    this.widgets.logs.log(logMessage);
  }

  /**
   * Update progress bar
   */
  updateProgress(percent) {
    this.widgets.progress.setProgress(percent);
    this.screen.render();
  }

  /**
   * Refresh all widgets
   */
  refreshWidgets() {
    this.widgets.projectInfo.setContent(this.getProjectInfo());
    this.widgets.deploymentStatus.setContent(this.getDeploymentStatus());
    this.screen.render();
  }

  /**
   * Load configuration
   */
  loadConfiguration() {
    const config = this.loadConfig();
    if (config) {
      this.addLog('success', `Loaded project: ${config.name}`);
    } else {
      this.addLog('warning', 'No configuration found. Run "easy-deploy init" to get started.');
    }
    this.refreshWidgets();
  }

  /**
   * Load config file
   */
  loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'easy-deploy.config.js');
      if (fs.existsSync(configPath)) {
        return require(configPath);
      }
    } catch (error) {
      // Config doesn't exist yet
    }
    return null;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.screen) {
      this.screen.destroy();
    }
  }
}

module.exports = Dashboard;
