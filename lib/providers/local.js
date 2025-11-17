const { Provider } = require('./index');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Local File Provider
 * Handles artifacts from local filesystem
 */
class LocalProvider extends Provider {
  constructor(config) {
    super(config);
    this.sourcePath = path.resolve(config.source);
  }

  /**
   * Detect artifact type
   */
  async detectType() {
    const stats = await fs.stat(this.sourcePath);

    if (stats.isFile()) {
      return this.detectFileType(this.sourcePath);
    } else {
      return await this.detectDirectoryType(this.sourcePath);
    }
  }

  /**
   * Detect file type from extension and content
   */
  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const typeMap = {
      '.html': 'html',
      '.htm': 'html',
      '.md': 'markdown',
      '.jsx': 'react',
      '.tsx': 'react',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.js': 'javascript',
      '.ts': 'typescript'
    };

    return typeMap[ext] || 'unknown';
  }

  /**
   * Detect directory type from contents
   */
  async detectDirectoryType(dirPath) {
    const files = await fs.readdir(dirPath);

    // Check for package.json
    if (files.includes('package.json')) {
      const packageJson = await fs.readJSON(path.join(dirPath, 'package.json'));

      // Check dependencies for framework detection
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react || deps['react-dom']) return 'react';
      if (deps.vue) return 'vue';
      if (deps.svelte) return 'svelte';
      if (deps.next) return 'next';
      if (deps.nuxt) return 'nuxt';

      return 'node';
    }

    // Check for HTML files
    if (files.some(f => f.endsWith('.html'))) {
      return 'html';
    }

    // Check for Markdown files
    if (files.some(f => f.endsWith('.md'))) {
      return 'markdown';
    }

    return 'unknown';
  }

  /**
   * Fetch artifact (copy to artifacts directory)
   */
  async fetch() {
    console.log(chalk.gray(`Fetching from local path: ${this.sourcePath}`));

    if (!await fs.pathExists(this.sourcePath)) {
      throw new Error(`Source path not found: ${this.sourcePath}`);
    }

    const destDir = path.join(process.cwd(), 'artifacts', this.config.name || path.basename(this.sourcePath));
    await fs.ensureDir(destDir);

    // Copy source to destination
    await fs.copy(this.sourcePath, destDir, {
      overwrite: true,
      errorOnExist: false
    });

    console.log(chalk.green(`✓ Copied to ${destDir}`));

    return {
      path: destDir,
      type: await this.detectType()
    };
  }

  /**
   * Validate artifact
   */
  async validate() {
    const exists = await fs.pathExists(this.sourcePath);
    if (!exists) {
      throw new Error(`Source path does not exist: ${this.sourcePath}`);
    }

    console.log(chalk.green('✓ Local artifact validated'));
    return true;
  }
}

module.exports = LocalProvider;
