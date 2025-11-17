#!/usr/bin/env node

/**
 * Quick test script for the wizard
 * Run with: node test-wizard.js
 */

const wizard = require('./lib/wizard');

console.log('Testing wizard directly...\n');

wizard.initialize({
  name: 'test-project'
})
.then(() => {
  console.log('\n✓ Wizard completed successfully!');
  process.exit(0);
})
.catch(error => {
  console.error('\n✗ Wizard failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
