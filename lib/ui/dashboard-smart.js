const blessed = require('blessed');
const contrib = require('blessed-contrib');
const UIComponents = require('./components');
const { icons } = require('./themes');
const ConfigDetector = require('../config-detector');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * Smart Dashboard with State Detection
 * Automatically detects project state and displays appropriate UI
 */
class SmartDashboard {
  constructor() {
    this.screen = null;
    this.components = null;
    this.detector = new ConfigDetector();
    this.state = null;
    this.currentView = null;
  }

  /**
   * Launch dashboard with state detection
   */
  async launch() {
    return new Promise(async (resolve, reject) => {
      try {
        this.exitCallback = resolve; // Store resolve for later

        this.createScreen();
        this.components = new UIComponents(this.screen);

        // Show loading screen
        const loadingBox = this.components.createLoadingBox('Detecting project state...');
        this.screen.append(loadingBox);
        this.screen.render();

        // Detect state
        this.state = await this.detector.detect();

        // Remove loading box
        loadingBox.destroy();

        // Show appropriate view based on state
        await this.showStateView();

        this.screen.render();

        // Promise will be resolved when user confirms exit
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create blessed screen
   */
  createScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Easy Deploy - Smart Dashboard',
      fullUnicode: true,
      dockBorders: true,
      autoPadding: true
    });

    // Global exit handler
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.confirmExit();
    });
  }

  /**
   * Show view based on detected state
   */
  async showStateView() {
    switch (this.state.type) {
      case 'first-launch':
        this.showFirstLaunchView();
        break;
      case 'configured-not-deployed':
        this.showReadyToDeployView();
        break;
      case 'running':
        this.showRunningView();
        break;
      case 'error':
        this.showErrorView();
        break;
      default:
        this.showFirstLaunchView();
    }
  }

  /**
   * First Launch View - Welcome and Quick Setup
   */
  showFirstLaunchView() {
    this.currentView = 'first-launch';

    const container = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      label: ' 👋 Welcome to Easy Deploy! ',
      padding: 2,
      tags: true
    });

    let content = `{center}{cyan-fg}{bold}No configuration found. Let's get started!{/bold}{/cyan-fg}{/center}\n\n`;

    // Show what was detected
    content += `{yellow-fg}Scanning current directory...{/yellow-fg}\n\n`;

    const summary = this.detector.getSummary();
    content += `  Docker:      ${summary.docker === '✓' ? '{green-fg}✓ Running{/green-fg}' : '{red-fg}✗ Not running{/red-fg}'}\n`;
    content += `  Artifacts:   ${summary.artifacts !== '✗' ? '{green-fg}' + summary.artifacts + '{/green-fg}' : '{yellow-fg}None found{/yellow-fg}'}\n`;
    content += `  Database:    ${summary.database}\n\n`;

    // Show suggestions
    if (this.state.suggestions && this.state.suggestions.length > 0) {
      content += `{cyan-fg}Detected:{/cyan-fg}\n`;
      this.state.suggestions.forEach((sug, i) => {
        content += `  ${icons.success} ${sug.message}\n`;
      });
      content += '\n';
    }

    content += `{white-fg}What would you like to do?{/white-fg}\n\n`;
    content += `  {cyan-fg}[1]{/cyan-fg} Quick Setup (recommended)\n`;
    content += `  {cyan-fg}[2]{/cyan-fg} Manual Configuration\n`;
    content += `  {cyan-fg}[3]{/cyan-fg} Import Existing Project\n`;
    content += `  {cyan-fg}[Q]{/cyan-fg} Exit\n`;

    container.setContent(content);
    this.screen.append(container);

    // Handle input - use container key bindings
    container.key(['1'], async () => {
      await this.runQuickSetup();
    });

    container.key(['2'], async () => {
      await this.runManualSetup();
    });

    container.key(['3'], async () => {
      await this.runImportProject();
    });

    container.focus();
  }

  /**
   * Ready to Deploy View
   */
  showReadyToDeployView() {
    this.currentView = 'ready-to-deploy';

    const container = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      label: ' Ready to Deploy ',
      padding: 2,
      tags: true
    });

    const config = this.state.config;

    let content = `{center}{bold}Configuration: ${config.name}{/bold}{/center}\n`;
    content += `{center}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{/center}\n\n`;

    const summary = this.detector.getSummary();
    content += `  ✓ Config loaded\n`;
    content += `  ${summary.docker === '✓' ? '✓' : '✗'} Docker ${summary.docker === '✓' ? 'running' : 'not running'}\n`;
    content += `  ${summary.artifacts !== '✗' ? '✓' : '✗'} Source: ${config.source}\n`;
    content += `  ⚠ Not deployed yet\n\n`;

    content += `{green-fg}Ready to deploy "${config.name}"!{/green-fg}\n\n`;

    content += `  {cyan-fg}[D]{/cyan-fg} Deploy Now\n`;
    content += `  {cyan-fg}[C]{/cyan-fg} Configure Settings\n`;
    content += `  {cyan-fg}[V]{/cyan-fg} View Configuration\n`;
    content += `  {cyan-fg}[Q]{/cyan-fg} Quit\n`;

    container.setContent(content);
    this.screen.append(container);

    // Handle input - use container key bindings
    container.key(['d'], async () => {
      await this.deployNow();
    });

    container.key(['c'], async () => {
      await this.configureSettings();
    });

    container.key(['v'], () => {
      this.viewConfiguration();
    });

    container.focus();
  }

  /**
   * Running View - Full monitoring dashboard
   */
  showRunningView() {
    this.currentView = 'running';

    // Create grid layout for running view
    const grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    const config = this.state.config;
    const deployment = this.state.deployment;

    // Header
    const header = grid.set(0, 0, 2, 12, blessed.box, {
      label: ' ● Easy Deploy - Running ',
      content: `{center}{cyan-fg}${config.name}{/cyan-fg}     {blue-fg}${deployment?.url || 'http://localhost:3000'}{/blue-fg}{/center}`,
      tags: true,
      border: {
        type: 'line',
        fg: 'green'
      }
    });

    // Status panel
    const statusBox = grid.set(2, 0, 5, 6, blessed.box, {
      label: ' Status ',
      border: {
        type: 'line'
      },
      tags: true
    });

    let statusContent = `  Status:    {green-fg}● Running{/green-fg}\n`;
    statusContent += `  Health:    {green-fg}✓ Healthy{/green-fg}\n`;
    statusContent += `  Uptime:    Loading...\n\n`;
    statusContent += `  Containers (${deployment?.containerCount || 0}):\n`;

    if (deployment?.containers) {
      deployment.containers.forEach(c => {
        statusContent += `  ├─ ${c.name.padEnd(15)} {green-fg}● ${c.status}{/green-fg}\n`;
      });
    }

    statusBox.setContent(statusContent);

    // Quick actions
    const actionsBox = grid.set(2, 6, 5, 6, blessed.list, {
      label: ' Quick Actions ',
      keys: true,
      vi: true,
      mouse: true,
      border: {
        type: 'line'
      },
      style: {
        selected: {
          bg: 'cyan',
          fg: 'black'
        }
      },
      items: [
        '🌐 Open in Browser',
        '🔄 Restart',
        '⏸️  Stop',
        '📊 View Logs',
        '⚙️  Settings',
        '❌ Exit'
      ]
    });

    actionsBox.on('select', (item, index) => {
      this.handleRunningAction(index);
    });

    // Activity log
    const logBox = grid.set(7, 0, 5, 12, blessed.log, {
      label: ' Activity Log ',
      tags: true,
      keys: true,
      vi: true,
      scrollable: true,
      scrollbar: {
        ch: ' ',
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line'
      }
    });

    logBox.log('{green-fg}[' + new Date().toLocaleTimeString() + '] ✓ Deployment running{/green-fg}');
    logBox.log('{cyan-fg}[' + new Date().toLocaleTimeString() + '] ℹ Dashboard initialized{/cyan-fg}');

    actionsBox.focus();
  }

  /**
   * Error View - Show errors and suggest fixes
   */
  showErrorView() {
    this.currentView = 'error';

    const container = blessed.box({
      top: 'center',
      left: 'center',
      width: '85%',
      height: '80%',
      border: {
        type: 'line',
        fg: 'red'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'red'
        }
      },
      label: ' ⚠ Configuration Error ',
      padding: 2,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });

    let content = `{red-fg}{bold}Configuration Issues Detected{/bold}{/red-fg}\n`;
    content += `{red-fg}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{/red-fg}\n\n`;

    // Show errors
    this.state.errors.forEach((error, i) => {
      const icon = error.severity === 'critical' ? '✗' : '⚠';
      const color = error.severity === 'critical' ? 'red' : 'yellow';

      content += `{${color}-fg}${icon} ${error.message}{/${color}-fg}\n`;
      content += `   ${error.description}\n\n`;
    });

    // Show fixes
    if (this.state.fixes && this.state.fixes.length > 0) {
      content += `{cyan-fg}Auto-Fix Available:{/cyan-fg}\n\n`;

      this.state.fixes.forEach((fix, i) => {
        const num = i + 1;
        content += `{cyan-fg}[${num}]{/cyan-fg} ${fix.description}\n`;
        fix.instructions.forEach(inst => {
          content += `     → ${inst}\n`;
        });
        content += '\n';
      });

      content += `{white-fg}Options:{/white-fg}\n`;
      content += `  {cyan-fg}[F]{/cyan-fg} Fix Issues Automatically\n`;
      content += `  {cyan-fg}[M]{/cyan-fg} Manual Fix Guide\n`;
      content += `  {cyan-fg}[T]{/cyan-fg} Try Again (Retry Detection)\n`;
      content += `  {cyan-fg}[R]{/cyan-fg} Reconfigure\n`;
      content += `  {cyan-fg}[Q]{/cyan-fg} Quit\n`;
    } else {
      content += `{white-fg}Options:{/white-fg}\n`;
      content += `  {cyan-fg}[T]{/cyan-fg} Try Again (Retry Detection)\n`;
      content += `  {cyan-fg}[R]{/cyan-fg} Reconfigure\n`;
      content += `  {cyan-fg}[Q]{/cyan-fg} Quit\n`;
    }

    container.setContent(content);
    this.screen.append(container);

    // Handle input - use container key bindings
    container.key(['f'], async () => {
      await this.autoFixIssues();
    });

    container.key(['m'], () => {
      this.showManualFixGuide();
    });

    container.key(['t'], async () => {
      await this.retryDetection();
    });

    container.key(['r'], async () => {
      await this.runManualSetup();
    });

    container.focus();
  }

  /**
   * Retry detection - Re-scan project state
   */
  async retryDetection() {
    // Clear screen
    this.screen.children.forEach(child => {
      child.detach();
    });

    // Show loading
    const loadingBox = this.components.createLoadingBox('Retrying detection...');
    this.screen.append(loadingBox);
    this.screen.render();

    // Re-detect state
    this.state = await this.detector.detect();

    // Remove loading
    loadingBox.destroy();

    // Show appropriate view
    await this.showStateView();
    this.screen.render();
  }

  /**
   * Action handlers
   */
  async runQuickSetup() {
    this.screen.destroy();
    const wizard = require('../wizard');
    await wizard.initialize({});
    process.exit(0);
  }

  async runManualSetup() {
    this.screen.destroy();
    const wizard = require('../wizard');
    await wizard.initialize({ skipQuick: true });
    process.exit(0);
  }

  async runImportProject() {
    this.components.showMessage('Import', 'Import feature coming soon!', 'info');
  }

  async deployNow() {
    this.screen.destroy();
    const deploy = require('../deploy');
    await deploy.run({});
  }

  async configureSettings() {
    this.components.showMessage('Settings', 'Settings editor coming soon!', 'info');
  }

  viewConfiguration() {
    const config = JSON.stringify(this.state.config, null, 2);
    this.components.showMessage('Configuration', config, 'info');
  }

  handleRunningAction(index) {
    const actions = [
      () => this.openInBrowser(),
      () => this.restartDeployment(),
      () => this.stopDeployment(),
      () => this.viewLogs(),
      () => this.openSettings(),
      () => this.confirmExit()
    ];

    if (actions[index]) {
      actions[index]();
    }
  }

  openInBrowser() {
    const url = this.state.deployment?.url || 'http://localhost:3000';
    require('child_process').exec(`open ${url}`);
  }

  async restartDeployment() {
    this.components.showMessage('Restart', 'Restart feature coming soon!', 'info');
  }

  async stopDeployment() {
    const DockerManager = require('../docker');
    const docker = new DockerManager(this.state.config);
    await docker.stopContainers();
    this.components.showMessage('Stopped', 'Deployment stopped', 'success');
  }

  viewLogs() {
    this.components.showMessage('Logs', 'Log viewer coming soon!', 'info');
  }

  openSettings() {
    this.components.showMessage('Settings', 'Settings coming soon!', 'info');
  }

  async autoFixIssues() {
    this.components.showMessage('Auto-Fix', 'Attempting to fix issues...', 'info');
    // TODO: Implement auto-fix
  }

  showManualFixGuide() {
    this.components.showMessage('Manual Fix', 'See console for instructions', 'info');
  }

  confirmExit() {
    this.components.createConfirmDialog(
      'Exit Dashboard',
      'Are you sure you want to exit?',
      (confirmed) => {
        if (confirmed) {
          this.cleanup();
          if (this.exitCallback) {
            this.exitCallback(); // Resolve the launch promise
          }
          process.exit(0);
        }
      }
    );
  }

  cleanup() {
    if (this.screen) {
      this.screen.destroy();
    }
  }
}

module.exports = SmartDashboard;
