# Quick Testing Guide

## Current Issues Being Fixed

1. **Double character input** (PPrriiccee--bbeenncchhmmaarrkk)
2. **Array index crashes** when entering invalid menu selections

## Quick Test Commands

### Test 1: Wizard Only (Bypasses Dashboard)
```bash
node test-wizard.js
```

This directly tests the wizard without the blessed dashboard interfering.

### Test 2: Full Dashboard Flow
```bash
npm start
```

Then press `1` to start Quick Setup.

### Test 3: Init Command Directly
```bash
node bin/easy-deploy.js init
```

## What to Look For

### ✅ GOOD Signs:
- Single characters when typing (e.g., "Price-benchmark" not "PPrriiccee--bbeenncchhmmaarrkk")
- Menu selections work with numbers 1-4
- Invalid input (like "11") falls back to default choice instead of crashing
- Wizard completes and creates files

### ❌ BAD Signs:
- Double characters still appearing
- Crashes with "Cannot read properties of undefined"
- Wizard doesn't accept input
- Screen doesn't clear properly

## Expected Output

When working correctly, you should see:
```
   ╭──────────────────────────────╮
   │                              │
   │   Easy Deploy Setup Wizard   │
   │                              │
   ╰──────────────────────────────╯

Let's set up your deployment project!

? Project name (Easy-Deploy): my-project    <-- Single characters!
? Artifact provider:
  > 1. Auto-detect
    2. Claude (Anthropic artifacts)
    3. Local files
    4. URL (remote)
Select (1-4): 1
? Source path or URL (./artifacts):
...
```

## Files Created After Success

```
easy-deploy.config.js  - Main configuration
.env.example          - Environment template
.env                  - Actual environment file
artifacts/            - Folder for your apps
  ├── README.md       - Instructions
  └── .gitkeep        - Keep folder in git
config/               - Config storage
data/                 - Database files
logs/                 - Log files
backups/              - Backup files
```

## Quick Fixes Applied

1. **100ms delay** - Ensures blessed screen fully destroyed before readline starts
2. **terminal: true** - Explicit terminal mode for readline
3. **Array bounds check** - Validates index before accessing array
4. **Fallback to default** - Uses default choice if invalid input

## Debug Mode

To see more output, modify test-wizard.js to log each step:

```javascript
const wizard = require('./lib/wizard');

console.log('Testing wizard directly...\n');
console.log('1. Starting wizard...');

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
```

## Next Steps Once Working

Once the wizard works without double characters:

1. Test full dashboard flow
2. Test deploying an actual artifact
3. Move to Phase 2 features:
   - Watch mode for artifacts
   - Health checker
   - Auto-fixer for common issues
   - Live reload during development

## Getting Help

If still having issues:
1. Check which Node version: `node --version` (need >= 16.0.0)
2. Clear terminal completely: `reset`
3. Try in a fresh terminal window
4. Check if blessed screen is lingering: `ps aux | grep node`
