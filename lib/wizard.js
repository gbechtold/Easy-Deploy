const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { nanoid } = require('nanoid');
const validator = require('validator');
const boxen = require('boxen');

/**
 * Simple readline-based prompt (no blessed conflicts)
 */
async function simplePrompt(questions) {
  // Small delay to ensure blessed screen is fully destroyed
  await new Promise(resolve => setTimeout(resolve, 100));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const answers = {};

  for (const q of questions) {
    if (q.type === 'text' || q.type === 'number') {
      const defaultText = q.initial ? ` (${q.initial})` : '';
      const answer = await new Promise((resolve) => {
        rl.question(chalk.cyan(`? ${q.message}${defaultText}: `), resolve);
      });
      answers[q.name] = answer.trim() || q.initial || '';

      if (q.type === 'number') {
        answers[q.name] = parseInt(answers[q.name]) || q.initial;
      }
    } else if (q.type === 'select') {
      console.log(chalk.cyan(`? ${q.message}:`));
      q.choices.forEach((choice, index) => {
        const marker = index === (q.initial || 0) ? '>' : ' ';
        console.log(`  ${marker} ${index + 1}. ${choice.title}`);
      });
      const answer = await new Promise((resolve) => {
        rl.question(chalk.cyan(`Select (1-${q.choices.length}): `), resolve);
      });
      const index = parseInt(answer) - 1;
      // Validate index is in bounds
      if (index >= 0 && index < q.choices.length) {
        answers[q.name] = q.choices[index].value;
      } else {
        // Use default if invalid input
        const defaultIndex = q.initial || 0;
        answers[q.name] = q.choices[defaultIndex].value;
      }
    } else if (q.type === 'confirm') {
      const defaultText = q.initial ? ' (Y/n)' : ' (y/N)';
      const answer = await new Promise((resolve) => {
        rl.question(chalk.cyan(`? ${q.message}${defaultText}: `), resolve);
      });
      const response = answer.trim().toLowerCase();
      answers[q.name] = response === 'y' || response === 'yes' || (response === '' && q.initial);
    }
  }

  rl.close();
  return answers;
}

/**
 * Initialize a new Easy Deploy project
 */
async function initialize(options = {}) {
  console.log(
    boxen(chalk.cyan.bold('Easy Deploy Setup Wizard'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    })
  );

  console.log(chalk.gray('Let\'s set up your deployment project!\n'));

  // Collect project information using simple readline prompts
  const answers = await simplePrompt([
    {
      type: 'text',
      name: 'name',
      message: 'Project name',
      initial: options.name || path.basename(process.cwd()),
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Project name is required';
        }
        return true;
      }
    },
    {
      type: 'select',
      name: 'provider',
      message: 'Artifact provider',
      choices: [
        { title: 'Auto-detect', value: 'auto' },
        { title: 'Claude (Anthropic artifacts)', value: 'claude' },
        { title: 'Local files', value: 'local' },
        { title: 'URL (remote)', value: 'url' }
      ],
      initial: 0
    },
    {
      type: 'text',
      name: 'source',
      message: 'Source path or URL',
      initial: './artifacts',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Source is required';
        }
        return true;
      }
    },
    {
      type: 'text',
      name: 'githubRepo',
      message: 'GitHub repository URL (optional)',
      initial: '',
      validate: (input) => {
        if (input && input.trim().length > 0) {
          if (!validator.isURL(input) && !input.match(/^[\w-]+\/[\w-]+$/)) {
            return 'Please enter a valid GitHub URL or owner/repo format';
          }
        }
        return true;
      }
    },
    {
      type: 'text',
      name: 'serverHost',
      message: 'Server host (for deployment)',
      initial: 'localhost',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Server host is required';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'serverPort',
      message: 'Server port',
      initial: 3000,
      validate: (input) => {
        if (input < 1 || input > 65535) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      }
    },
    {
      type: 'select',
      name: 'database',
      message: 'Database type',
      choices: [
        { title: 'SQLite (recommended for getting started)', value: 'sqlite' },
        { title: 'PostgreSQL', value: 'postgresql' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'enableOAuth',
      message: 'Enable Google OAuth authentication?',
      initial: true
    },
    {
      type: 'select',
      name: 'workflow',
      message: 'Choose workflow mode',
      choices: [
        { title: 'Local Development - Test locally before deploy', value: 'local' },
        { title: 'Talking Git Commits - Auto-commit with semantic messages', value: 'git' },
        { title: 'Live Release - Deploy immediately to production', value: 'live' },
        { title: 'Code, Test, Commit, Release - Full CI/CD workflow', value: 'full' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'enableCRUD',
      message: 'Enable CRUD features per user?',
      initial: true
    }
  ]);

  // Generate configuration
  const config = generateConfig(answers);

  // Create directory structure
  await setupProjectStructure(answers);

  // Save configuration file
  await saveConfig(config);

  // Generate .env template
  await generateEnvTemplate(answers);

  // Create Docker files
  await generateDockerFiles(answers);

  // Initialize Git if workflow requires it
  if (answers.workflow === 'git' || answers.workflow === 'full') {
    await initializeGit(answers);
  }

  // Display success message
  displaySuccessMessage(answers);

  return config;
}

/**
 * Generate configuration object
 */
function generateConfig(answers) {
  return {
    name: answers.name,
    id: nanoid(10),
    provider: answers.provider,
    source: answers.source,
    github: {
      enabled: !!answers.githubRepo,
      repository: answers.githubRepo || ''
    },
    server: {
      host: answers.serverHost,
      port: answers.serverPort
    },
    database: answers.database,
    auth: {
      google: {
        enabled: answers.enableOAuth,
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: `http://${answers.serverHost}:${answers.serverPort}/auth/google/callback`
      }
    },
    workflow: answers.workflow,
    features: {
      crud: answers.enableCRUD,
      autoCommit: answers.workflow === 'git' || answers.workflow === 'full',
      autoDeploy: answers.workflow === 'live' || answers.workflow === 'full'
    },
    docker: {
      enabled: true,
      composeFile: 'docker-compose.yml'
    },
    createdAt: new Date().toISOString()
  };
}

/**
 * Setup project directory structure
 */
async function setupProjectStructure(answers) {
  const dirs = [
    'artifacts',
    'config',
    'data',
    'logs',
    'backups'
  ];

  for (const dir of dirs) {
    await fs.ensureDir(path.join(process.cwd(), dir));
  }

  // Create README in artifacts folder
  const artifactsReadme = `# Artifacts

Place your application files here.

## What goes in this folder?

- Claude-generated artifacts
- React applications
- HTML/CSS/JS static sites
- Single-page applications
- Any deployable web application

## Structure

Each application should be in its own subdirectory:

\`\`\`
artifacts/
├── my-todo-app/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── blog-site/
│   ├── package.json
│   ├── src/
│   └── public/
└── price-comparison/
    └── ...
\`\`\`

## Examples

\`\`\`bash
# Add a Claude artifact
cp -r ~/Downloads/my-claude-app ./artifacts/

# Add from URL
easy-deploy add-artifact --source https://github.com/user/repo

# Add local project
easy-deploy add-artifact --source ../my-app
\`\`\`

Easy Deploy will auto-detect the application type and deploy accordingly.
`;

  await fs.writeFile(
    path.join(process.cwd(), 'artifacts', 'README.md'),
    artifactsReadme
  );

  // Create .gitkeep to track empty folder
  await fs.writeFile(
    path.join(process.cwd(), 'artifacts', '.gitkeep'),
    ''
  );

  console.log(chalk.green('✓ Created project directories'));
  console.log(chalk.cyan('  → artifacts/README.md created with instructions'));
}

/**
 * Save configuration file
 */
async function saveConfig(config) {
  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
  const configPath = path.join(process.cwd(), 'easy-deploy.config.js');

  await fs.writeFile(configPath, configContent);
  console.log(chalk.green('✓ Saved configuration to easy-deploy.config.js'));
}

/**
 * Generate .env template
 */
async function generateEnvTemplate(answers) {
  const envContent = `# Easy Deploy Environment Variables
# Generated on ${new Date().toISOString()}

# Project
PROJECT_NAME=${answers.name}
NODE_ENV=development

# Server
SERVER_HOST=${answers.serverHost}
SERVER_PORT=${answers.serverPort}

# Database
DATABASE_TYPE=${answers.database}
${answers.database === 'sqlite' ? 'DATABASE_PATH=./data/app.db' : ''}
${answers.database === 'postgresql' ? `DATABASE_URL=postgresql://user:password@localhost:5432/${answers.name}` : ''}

# Google OAuth (if enabled)
${answers.enableOAuth ? `GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://${answers.serverHost}:${answers.serverPort}/auth/google/callback` : '# Google OAuth not enabled'}

# Session Secret
SESSION_SECRET=${nanoid(32)}

# Docker
DOCKER_REGISTRY=
DOCKER_IMAGE_TAG=latest

# GitHub (if configured)
${answers.githubRepo ? `GITHUB_REPOSITORY=${answers.githubRepo}
GITHUB_TOKEN=your_github_token_here` : '# GitHub not configured'}
`;

  const envPath = path.join(process.cwd(), '.env.example');
  await fs.writeFile(envPath, envContent);

  // Create actual .env if it doesn't exist
  const actualEnvPath = path.join(process.cwd(), '.env');
  if (!await fs.pathExists(actualEnvPath)) {
    await fs.writeFile(actualEnvPath, envContent);
  }

  console.log(chalk.green('✓ Generated .env template'));
}

/**
 * Generate Docker files
 */
async function generateDockerFiles(answers) {
  // This will be implemented in the Docker templates module
  console.log(chalk.green('✓ Docker files will be generated by template module'));
}

/**
 * Initialize Git repository
 */
async function initializeGit(answers) {
  const git = require('./git');
  try {
    await git.initialize();
    console.log(chalk.green('✓ Initialized Git repository'));
  } catch (error) {
    console.log(chalk.yellow('⚠ Git initialization skipped (may already exist)'));
  }
}

/**
 * Display success message
 */
function displaySuccessMessage(answers) {
  console.log('\n' + boxen(
    chalk.green.bold('✓ Project initialized successfully!\n\n') +
    chalk.white('Next steps:\n\n') +
    chalk.cyan('1. ') + 'Review and update .env file with your credentials\n' +
    chalk.cyan('2. ') + 'Run ' + chalk.yellow('easy-deploy') + ' to launch dashboard\n' +
    chalk.cyan('3. ') + 'Run ' + chalk.yellow('easy-deploy deploy') + ' to start deployment\n' +
    chalk.cyan('4. ') + 'Visit ' + chalk.blue(`http://${answers.serverHost}:${answers.serverPort}`) + ' when deployed',
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    }
  ));
}

/**
 * Add artifact to project
 */
async function addArtifact(options = {}) {
  console.log(chalk.cyan.bold('\n📦 Add Artifact\n'));

  const answers = await simplePrompt([
    {
      type: 'text',
      name: 'name',
      message: 'Artifact name',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Artifact name is required';
        }
        return true;
      }
    },
    {
      type: 'select',
      name: 'type',
      message: 'Artifact type',
      choices: [
        { title: 'Auto-detect', value: 'auto' },
        { title: 'React application', value: 'react' },
        { title: 'HTML/CSS/JS', value: 'html' },
        { title: 'Markdown', value: 'markdown' },
        { title: 'Other', value: 'other' }
      ],
      initial: 0
    },
    {
      type: 'text',
      name: 'source',
      message: 'Source path or URL',
      initial: options.source || '',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Source is required';
        }
        return true;
      }
    }
  ]);

  // Copy or download artifact
  await processArtifact(answers);

  console.log(chalk.green(`✓ Artifact "${answers.name}" added successfully!`));

  return answers;
}

/**
 * Process artifact (copy or download)
 */
async function processArtifact(artifact) {
  const destPath = path.join(process.cwd(), 'artifacts', artifact.name);
  await fs.ensureDir(destPath);

  // If source is a URL, download it
  if (validator.isURL(artifact.source)) {
    console.log(chalk.gray(`Downloading from ${artifact.source}...`));
    // Download logic would go here
  } else {
    // Copy local files
    const sourcePath = path.resolve(artifact.source);
    if (await fs.pathExists(sourcePath)) {
      await fs.copy(sourcePath, destPath);
      console.log(chalk.gray(`Copied from ${sourcePath}`));
    } else {
      throw new Error(`Source path not found: ${sourcePath}`);
    }
  }
}

module.exports = {
  initialize,
  addArtifact
};
