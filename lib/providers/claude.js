const { Provider } = require('./index');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

/**
 * Claude Artifact Provider
 * Handles artifacts from Claude (Anthropic)
 */
class ClaudeProvider extends Provider {
  constructor(config) {
    super(config);
    this.artifactPath = null;
  }

  /**
   * Detect artifact type from content
   */
  async detectType() {
    const content = await this.readArtifactContent();

    // Check for React patterns
    if (this.containsReactPatterns(content)) {
      return 'react';
    }

    // Check for HTML
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      return 'html';
    }

    // Check for Markdown
    if (this.config.source.endsWith('.md') || content.match(/^#\s+/m)) {
      return 'markdown';
    }

    // Check for Vue
    if (content.includes('<template>') || content.includes('Vue.component')) {
      return 'vue';
    }

    // Check for Svelte
    if (content.includes('<script>') && content.includes('<style>') && this.config.source.endsWith('.svelte')) {
      return 'svelte';
    }

    return 'unknown';
  }

  /**
   * Check if content contains React patterns
   */
  containsReactPatterns(content) {
    const reactPatterns = [
      'import React',
      'from \'react\'',
      'from "react"',
      'useState',
      'useEffect',
      'className=',
      'jsx',
      'React.Component',
      '<div',
      'export default function'
    ];

    return reactPatterns.some(pattern => content.includes(pattern));
  }

  /**
   * Fetch artifact from source
   */
  async fetch() {
    console.log(chalk.gray('Fetching Claude artifact...'));

    const destDir = path.join(process.cwd(), 'artifacts', this.config.name || 'claude-artifact');
    await fs.ensureDir(destDir);

    // If source is a URL, download it
    if (this.config.source.match(/^https?:\/\//)) {
      await this.downloadFromURL(destDir);
    } else {
      // Copy from local path
      await this.copyFromLocal(destDir);
    }

    this.artifactPath = destDir;
    console.log(chalk.green(`✓ Artifact fetched to ${destDir}`));

    return {
      path: destDir,
      type: await this.detectType()
    };
  }

  /**
   * Download artifact from URL
   */
  async downloadFromURL(destDir) {
    try {
      // Note: In reality, Claude artifacts might require special handling
      // This is a simplified implementation
      const response = await axios.get(this.config.source);
      const filename = path.basename(this.config.source) || 'artifact.html';
      const destPath = path.join(destDir, filename);

      await fs.writeFile(destPath, response.data);
      console.log(chalk.gray(`Downloaded to ${destPath}`));
    } catch (error) {
      throw new Error(`Failed to download artifact: ${error.message}`);
    }
  }

  /**
   * Copy artifact from local path
   */
  async copyFromLocal(destDir) {
    const sourcePath = path.resolve(this.config.source);

    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`Source path not found: ${sourcePath}`);
    }

    const stats = await fs.stat(sourcePath);

    if (stats.isDirectory()) {
      await fs.copy(sourcePath, destDir);
    } else {
      const filename = path.basename(sourcePath);
      await fs.copy(sourcePath, path.join(destDir, filename));
    }

    console.log(chalk.gray(`Copied from ${sourcePath}`));
  }

  /**
   * Read artifact content for type detection
   */
  async readArtifactContent() {
    const sourcePath = path.resolve(this.config.source);

    // If URL, fetch content
    if (this.config.source.match(/^https?:\/\//)) {
      try {
        const response = await axios.get(this.config.source);
        return response.data;
      } catch (error) {
        return '';
      }
    }

    // If local file, read it
    if (await fs.pathExists(sourcePath)) {
      const stats = await fs.stat(sourcePath);
      if (stats.isFile()) {
        return await fs.readFile(sourcePath, 'utf-8');
      } else {
        // Directory - try to find index file
        const indexFiles = ['index.html', 'index.jsx', 'index.js', 'App.jsx', 'README.md'];
        for (const file of indexFiles) {
          const filePath = path.join(sourcePath, file);
          if (await fs.pathExists(filePath)) {
            return await fs.readFile(filePath, 'utf-8');
          }
        }
      }
    }

    return '';
  }

  /**
   * Validate artifact
   */
  async validate() {
    if (!this.artifactPath) {
      throw new Error('Artifact not fetched yet. Call fetch() first.');
    }

    const exists = await fs.pathExists(this.artifactPath);
    if (!exists) {
      throw new Error(`Artifact path does not exist: ${this.artifactPath}`);
    }

    // Check if directory has files
    const files = await fs.readdir(this.artifactPath);
    if (files.length === 0) {
      throw new Error('Artifact directory is empty');
    }

    console.log(chalk.green('✓ Artifact validated'));
    return true;
  }

  /**
   * Prepare artifact for deployment
   */
  async prepare() {
    const artifactType = await this.detectType();

    console.log(chalk.cyan(`Detected artifact type: ${artifactType}`));

    // Type-specific preparation
    switch (artifactType) {
      case 'react':
        await this.prepareReact();
        break;
      case 'html':
        await this.prepareHTML();
        break;
      case 'markdown':
        await this.prepareMarkdown();
        break;
      default:
        console.log(chalk.yellow('⚠ Unknown artifact type, using default preparation'));
    }

    return artifactType;
  }

  /**
   * Prepare React artifact
   */
  async prepareReact() {
    console.log(chalk.gray('Preparing React artifact...'));

    // Check for package.json
    const packageJsonPath = path.join(this.artifactPath, 'package.json');
    const hasPackageJson = await fs.pathExists(packageJsonPath);

    if (!hasPackageJson) {
      // Create basic package.json for standalone React file
      const packageJson = {
        name: this.config.name || 'react-app',
        version: '1.0.0',
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'react-scripts': '^5.0.1'
        }
      };

      await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
      console.log(chalk.gray('Created package.json'));
    }
  }

  /**
   * Prepare HTML artifact
   */
  async prepareHTML() {
    console.log(chalk.gray('Preparing HTML artifact...'));
    // HTML is ready to deploy as-is
  }

  /**
   * Prepare Markdown artifact
   */
  async prepareMarkdown() {
    console.log(chalk.gray('Preparing Markdown artifact...'));
    // Could convert to HTML or set up a Markdown viewer
  }
}

module.exports = ClaudeProvider;
