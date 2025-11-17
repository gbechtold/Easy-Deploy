const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Provider interface for artifact sources
 */
class Provider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Detect artifact type from source
   */
  async detectType() {
    throw new Error('detectType() must be implemented by provider');
  }

  /**
   * Fetch artifact from source
   */
  async fetch() {
    throw new Error('fetch() must be implemented by provider');
  }

  /**
   * Validate artifact
   */
  async validate() {
    throw new Error('validate() must be implemented by provider');
  }
}

/**
 * Auto-detect and return appropriate provider
 */
async function detectProvider(source, config = {}) {
  // Check if URL
  if (source.match(/^https?:\/\//)) {
    // Check if it's a Claude artifact URL
    if (source.includes('claude.ai') || source.includes('anthropic.com')) {
      const ClaudeProvider = require('./claude');
      return new ClaudeProvider({ ...config, source });
    }
    // Generic URL provider
    const URLProvider = require('./url');
    return new URLProvider({ ...config, source });
  }

  // Check if local path
  if (await fs.pathExists(source)) {
    const LocalProvider = require('./local');
    return new LocalProvider({ ...config, source });
  }

  throw new Error(`Unable to detect provider for source: ${source}`);
}

/**
 * Get provider by name
 */
function getProvider(providerName, config) {
  const providers = {
    claude: require('./claude'),
    local: require('./local'),
    url: require('./url')
  };

  const ProviderClass = providers[providerName];
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  return new ProviderClass(config);
}

/**
 * Create provider from config
 */
async function createProvider(config) {
  const providerType = config.provider || 'auto';

  if (providerType === 'auto') {
    console.log(chalk.gray('Auto-detecting provider...'));
    return await detectProvider(config.source, config);
  }

  return getProvider(providerType, config);
}

module.exports = {
  Provider,
  detectProvider,
  getProvider,
  createProvider
};
