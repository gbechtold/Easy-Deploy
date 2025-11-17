const simpleGit = require('simple-git');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * Git automation with semantic commits
 */
class GitManager {
  constructor(repoPath = process.cwd()) {
    this.git = simpleGit(repoPath);
    this.repoPath = repoPath;
  }

  /**
   * Initialize Git repository
   */
  async initialize() {
    try {
      const isRepo = await this.git.checkIsRepo();

      if (!isRepo) {
        await this.git.init();
        await this.createGitignore();
        console.log(chalk.green('✓ Git repository initialized'));

        // Initial commit
        await this.git.add('.');
        await this.git.commit('Initial commit by Easy Deploy\n\n🤖 Generated with Easy Deploy');
        console.log(chalk.green('✓ Initial commit created'));
      } else {
        console.log(chalk.gray('Git repository already initialized'));
      }
    } catch (error) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }

  /**
   * Create .gitignore file
   */
  async createGitignore() {
    const gitignorePath = path.join(this.repoPath, '.gitignore');

    if (await fs.pathExists(gitignorePath)) {
      return; // Don't overwrite existing .gitignore
    }

    const gitignoreContent = `# Easy Deploy - Generated .gitignore

# Environment variables
.env
.env.local
.env.*.local

# Database
data/*.db
data/*.db-shm
data/*.db-wal

# Logs
logs/
*.log

# Backups
backups/

# Node modules
node_modules/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
tmp/
temp/
*.tmp

# Docker
docker-compose.override.yml

# Build artifacts
dist/
build/
*.tgz
`;

    await fs.writeFile(gitignorePath, gitignoreContent);
    console.log(chalk.gray('Created .gitignore'));
  }

  /**
   * Check repository status
   */
  async status() {
    try {
      return await this.git.status();
    } catch (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Stage files
   */
  async stage(files = '.') {
    try {
      await this.git.add(files);
      console.log(chalk.green(`✓ Staged: ${files}`));
    } catch (error) {
      throw new Error(`Failed to stage files: ${error.message}`);
    }
  }

  /**
   * Create semantic commit
   */
  async commit(options = {}) {
    try {
      const status = await this.git.status();

      if (status.files.length === 0) {
        console.log(chalk.yellow('⚠ No changes to commit'));
        return null;
      }

      // Auto-stage all changes if not specified
      if (!options.staged) {
        await this.stage('.');
      }

      // Generate semantic commit message
      const message = options.message || await this.generateCommitMessage(status);

      // Add Easy Deploy footer
      const fullMessage = `${message}\n\n🤖 Generated with Easy Deploy`;

      await this.git.commit(fullMessage);
      console.log(chalk.green('✓ Committed:'), message);

      // Push if requested
      if (options.push) {
        await this.push();
      }

      return message;
    } catch (error) {
      throw new Error(`Commit failed: ${error.message}`);
    }
  }

  /**
   * Generate semantic commit message based on changes
   */
  async generateCommitMessage(status) {
    const { created, modified, deleted, renamed } = status;

    // Determine commit type
    let type = 'chore';
    let scope = '';
    let subject = '';

    if (created.length > 0) {
      type = 'feat';
      scope = this.inferScope(created);
      subject = `add ${this.summarizeFiles(created)}`;
    } else if (modified.length > 0) {
      type = 'update';
      scope = this.inferScope(modified);
      subject = `update ${this.summarizeFiles(modified)}`;
    } else if (deleted.length > 0) {
      type = 'remove';
      scope = this.inferScope(deleted);
      subject = `remove ${this.summarizeFiles(deleted)}`;
    } else if (renamed.length > 0) {
      type = 'refactor';
      subject = `rename ${renamed.length} file${renamed.length > 1 ? 's' : ''}`;
    }

    // Construct message
    if (scope) {
      return `${type}(${scope}): ${subject}`;
    } else {
      return `${type}: ${subject}`;
    }
  }

  /**
   * Infer scope from file paths
   */
  inferScope(files) {
    if (files.length === 0) return '';

    const firstFile = files[0];
    const parts = firstFile.split('/');

    if (parts.length > 1) {
      // Use directory name as scope
      return parts[0];
    }

    return '';
  }

  /**
   * Summarize files for commit message
   */
  summarizeFiles(files) {
    if (files.length === 0) return 'files';
    if (files.length === 1) return path.basename(files[0]);
    if (files.length <= 3) {
      return files.map(f => path.basename(f)).join(', ');
    }

    return `${files.length} files`;
  }

  /**
   * Push to remote
   */
  async push(remote = 'origin', branch = null) {
    try {
      // Get current branch if not specified
      if (!branch) {
        const status = await this.git.status();
        branch = status.current;
      }

      console.log(chalk.gray(`Pushing to ${remote}/${branch}...`));

      await this.git.push(remote, branch);
      console.log(chalk.green(`✓ Pushed to ${remote}/${branch}`));
    } catch (error) {
      throw new Error(`Push failed: ${error.message}`);
    }
  }

  /**
   * Pull from remote
   */
  async pull(remote = 'origin', branch = null) {
    try {
      if (!branch) {
        const status = await this.git.status();
        branch = status.current;
      }

      console.log(chalk.gray(`Pulling from ${remote}/${branch}...`));

      await this.git.pull(remote, branch);
      console.log(chalk.green(`✓ Pulled from ${remote}/${branch}`));
    } catch (error) {
      throw new Error(`Pull failed: ${error.message}`);
    }
  }

  /**
   * Add remote repository
   */
  async addRemote(name, url) {
    try {
      await this.git.addRemote(name, url);
      console.log(chalk.green(`✓ Added remote: ${name} → ${url}`));
    } catch (error) {
      // Remote might already exist
      if (error.message.includes('already exists')) {
        console.log(chalk.gray(`Remote ${name} already exists`));
      } else {
        throw new Error(`Failed to add remote: ${error.message}`);
      }
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit() {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest.hash;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a tag
   */
  async tag(tagName, message = null) {
    try {
      if (message) {
        await this.git.addAnnotatedTag(tagName, message);
      } else {
        await this.git.addTag(tagName);
      }
      console.log(chalk.green(`✓ Created tag: ${tagName}`));
    } catch (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }
  }

  /**
   * Get commit log
   */
  async log(options = {}) {
    try {
      const maxCount = options.maxCount || 10;
      return await this.git.log({ maxCount });
    } catch (error) {
      throw new Error(`Failed to get log: ${error.message}`);
    }
  }

  /**
   * Create branch
   */
  async createBranch(branchName) {
    try {
      await this.git.checkoutLocalBranch(branchName);
      console.log(chalk.green(`✓ Created and switched to branch: ${branchName}`));
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Switch branch
   */
  async checkout(branchName) {
    try {
      await this.git.checkout(branchName);
      console.log(chalk.green(`✓ Switched to branch: ${branchName}`));
    } catch (error) {
      throw new Error(`Failed to checkout branch: ${error.message}`);
    }
  }
}

/**
 * Talking Git Commits workflow
 * Auto-commits with semantic messages at regular intervals or on specific events
 */
class TalkingGitWorkflow {
  constructor(gitManager, interval = 300000) { // 5 minutes default
    this.gitManager = gitManager;
    this.interval = interval;
    this.timer = null;
  }

  /**
   * Start auto-commit workflow
   */
  start() {
    console.log(chalk.cyan('Starting Talking Git Commits workflow...'));

    this.timer = setInterval(async () => {
      try {
        const status = await this.gitManager.status();

        if (status.files.length > 0) {
          console.log(chalk.gray('\n[Auto-commit] Changes detected'));
          await this.gitManager.commit({ push: true });
        }
      } catch (error) {
        console.error(chalk.red('[Auto-commit] Error:'), error.message);
      }
    }, this.interval);

    console.log(chalk.green(`✓ Auto-commit enabled (every ${this.interval / 1000}s)`));
  }

  /**
   * Stop auto-commit workflow
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(chalk.gray('Auto-commit stopped'));
    }
  }
}

module.exports = GitManager;
module.exports.TalkingGitWorkflow = TalkingGitWorkflow;
