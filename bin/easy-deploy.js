#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const packageJson = require('../package.json');
const Dashboard = require('../lib/ui/dashboard');
const wizard = require('../lib/wizard');
const deploy = require('../lib/deploy');
const { checkStatus } = require('../lib/docker');

const program = new Command();

// Display banner
console.log(
  chalk.cyan(
    figlet.textSync('Easy Deploy', {
      font: 'Standard',
      horizontalLayout: 'default'
    })
  )
);

console.log(chalk.gray(`v${packageJson.version} - Provider-agnostic deployment made easy\n`));

program
  .name('easy-deploy')
  .description('Deploy Claude artifacts and web apps with Docker, GitHub, and OAuth')
  .version(packageJson.version);

// Main command - launches terminal UI
program
  .command('dashboard', { isDefault: true })
  .description('Launch interactive terminal dashboard')
  .action(async () => {
    try {
      const dashboard = new Dashboard();
      await dashboard.launch();
    } catch (error) {
      console.error(chalk.red('Error launching dashboard:'), error.message);
      process.exit(1);
    }
  });

// Initialize new project
program
  .command('init')
  .description('Initialize a new deployment project')
  .option('-n, --name <name>', 'Project name')
  .option('-p, --provider <provider>', 'Artifact provider (auto, claude, local, url)', 'auto')
  .action(async (options) => {
    try {
      await wizard.initialize(options);
    } catch (error) {
      console.error(chalk.red('Initialization failed:'), error.message);
      process.exit(1);
    }
  });

// Quick deploy without UI
program
  .command('quick')
  .description('Quick deploy without interactive UI')
  .option('-c, --config <path>', 'Path to config file', './easy-deploy.config.js')
  .action(async (options) => {
    try {
      await deploy.quick(options.config);
    } catch (error) {
      console.error(chalk.red('Deployment failed:'), error.message);
      process.exit(1);
    }
  });

// Add artifact to project
program
  .command('add-artifact')
  .description('Add a new artifact to the project')
  .option('-s, --source <path>', 'Source path or URL')
  .option('-t, --type <type>', 'Artifact type (react, html, markdown, auto)', 'auto')
  .action(async (options) => {
    try {
      await wizard.addArtifact(options);
    } catch (error) {
      console.error(chalk.red('Failed to add artifact:'), error.message);
      process.exit(1);
    }
  });

// Deploy to server
program
  .command('deploy')
  .description('Deploy application to server')
  .option('-c, --config <path>', 'Path to config file', './easy-deploy.config.js')
  .option('-e, --env <environment>', 'Deployment environment', 'production')
  .action(async (options) => {
    try {
      await deploy.run(options);
    } catch (error) {
      console.error(chalk.red('Deployment failed:'), error.message);
      process.exit(1);
    }
  });

// Check deployment status
program
  .command('status')
  .description('Check deployment status')
  .option('-c, --config <path>', 'Path to config file', './easy-deploy.config.js')
  .action(async (options) => {
    try {
      const status = await checkStatus(options.config);
      console.log(chalk.green('Deployment Status:'));
      console.log(status);
    } catch (error) {
      console.error(chalk.red('Failed to get status:'), error.message);
      process.exit(1);
    }
  });

// Git operations
program
  .command('git')
  .description('Git operations with semantic commits')
  .option('-m, --message <message>', 'Commit message')
  .option('--push', 'Push to remote after commit')
  .action(async (options) => {
    try {
      const git = require('../lib/git');
      await git.commit(options);
    } catch (error) {
      console.error(chalk.red('Git operation failed:'), error.message);
      process.exit(1);
    }
  });

// Database operations
program
  .command('db')
  .description('Database operations')
  .option('--migrate', 'Run migrations')
  .option('--seed', 'Seed database')
  .option('--reset', 'Reset database')
  .action(async (options) => {
    try {
      const database = require('../lib/database');
      await database.manage(options);
    } catch (error) {
      console.error(chalk.red('Database operation failed:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
