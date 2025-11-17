const { Provider } = require('./index');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const unzipper = require('unzipper');

/**
 * URL Provider
 * Handles artifacts from remote URLs
 */
class URLProvider extends Provider {
  constructor(config) {
    super(config);
    this.downloadedPath = null;
  }

  /**
   * Detect artifact type from URL and content
   */
  async detectType() {
    const url = this.config.source;

    // Check URL extension
    if (url.match(/\.zip$/i)) return 'zip';
    if (url.match(/\.tar\.gz$/i)) return 'tarball';
    if (url.match(/\.html?$/i)) return 'html';
    if (url.match(/\.md$/i)) return 'markdown';

    // Check if it's a GitHub repository
    if (url.includes('github.com')) {
      return 'github';
    }

    // Try to detect from content-type header
    try {
      const response = await axios.head(url);
      const contentType = response.headers['content-type'];

      if (contentType.includes('text/html')) return 'html';
      if (contentType.includes('text/markdown')) return 'markdown';
      if (contentType.includes('application/zip')) return 'zip';
    } catch (error) {
      console.log(chalk.yellow('⚠ Could not detect type from headers'));
    }

    return 'unknown';
  }

  /**
   * Fetch artifact from URL
   */
  async fetch() {
    console.log(chalk.gray(`Downloading from: ${this.config.source}`));

    const destDir = path.join(process.cwd(), 'artifacts', this.config.name || 'remote-artifact');
    await fs.ensureDir(destDir);

    const type = await this.detectType();

    if (type === 'github') {
      await this.fetchFromGitHub(destDir);
    } else if (type === 'zip') {
      await this.fetchZip(destDir);
    } else {
      await this.fetchFile(destDir);
    }

    this.downloadedPath = destDir;
    console.log(chalk.green(`✓ Downloaded to ${destDir}`));

    return {
      path: destDir,
      type: type
    };
  }

  /**
   * Fetch from GitHub repository
   */
  async fetchFromGitHub(destDir) {
    // Convert GitHub URL to ZIP download URL
    let zipUrl = this.config.source;

    // Handle different GitHub URL formats
    if (zipUrl.includes('/tree/')) {
      // Branch URL
      zipUrl = zipUrl.replace('/tree/', '/archive/refs/heads/') + '.zip';
    } else if (!zipUrl.endsWith('.zip')) {
      // Repository root - default to main branch
      zipUrl = zipUrl.replace(/\/$/, '') + '/archive/refs/heads/main.zip';
    }

    console.log(chalk.gray(`Downloading GitHub repository...`));

    try {
      const response = await axios({
        method: 'GET',
        url: zipUrl,
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        response.data
          .pipe(unzipper.Extract({ path: destDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      console.log(chalk.gray('Extracted GitHub repository'));
    } catch (error) {
      throw new Error(`Failed to download from GitHub: ${error.message}`);
    }
  }

  /**
   * Fetch ZIP file
   */
  async fetchZip(destDir) {
    try {
      const response = await axios({
        method: 'GET',
        url: this.config.source,
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        response.data
          .pipe(unzipper.Extract({ path: destDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      console.log(chalk.gray('Extracted ZIP file'));
    } catch (error) {
      throw new Error(`Failed to download ZIP: ${error.message}`);
    }
  }

  /**
   * Fetch single file
   */
  async fetchFile(destDir) {
    try {
      const response = await axios.get(this.config.source);
      const filename = path.basename(this.config.source) || 'index.html';
      const destPath = path.join(destDir, filename);

      await fs.writeFile(destPath, response.data);
      console.log(chalk.gray(`Downloaded file: ${filename}`));
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Validate artifact
   */
  async validate() {
    if (!this.downloadedPath) {
      throw new Error('Artifact not downloaded yet. Call fetch() first.');
    }

    const exists = await fs.pathExists(this.downloadedPath);
    if (!exists) {
      throw new Error(`Downloaded path does not exist: ${this.downloadedPath}`);
    }

    console.log(chalk.green('✓ Remote artifact validated'));
    return true;
  }
}

module.exports = URLProvider;
