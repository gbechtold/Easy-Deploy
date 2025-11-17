# Easy Deploy - Concept & Implementation Plan

## 1. CLI Startup Clarification

### Current State Analysis

**Issue:** Documentation says `easy-deploy init` but users need `npm start`

**Root Cause:**
- `bin/easy-deploy.js` has shebang `#!/usr/bin/env node`
- Binary is defined in package.json: `"bin": { "easy-deploy": "./bin/easy-deploy.js" }`
- After `npm link` or global install, `easy-deploy` command should work
- `npm start` works locally but isn't the intended CLI command

### Correct Usage

```bash
# Development (in Easy-Deploy repo):
npm start                    # Runs node bin/easy-deploy.js (shows help)
npm start -- init           # Would need script changes
node bin/easy-deploy.js init # Direct execution

# After npm link (global):
easy-deploy                 # Shows help
easy-deploy init            # Initialize project
easy-deploy                 # Launch dashboard (default command)

# After npm install -g easy-deploy:
easy-deploy                 # Global command
```

### Fix Required

1. Update README.md to clarify installation methods
2. Make dashboard the TRUE default (no command needed)
3. Add development instructions

---

## 2. Claude Code Integration Patterns

### Concept: Seamless Terminal Workflow

When using Claude Code and Easy Deploy together, we need smart integration.

### ASCII Concept - Split Terminal Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Terminal 1: Claude Code                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ $ You: "Create a React todo app"                                │ │
│ │ $ Claude: *generates code in ./artifacts/todo-app*              │ │
│ │ $ You: "Now deploy it"                                          │ │
│ │ $ Claude: *runs: easy-deploy add-artifact --source ./artifacts* │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Terminal 2: Easy Deploy Dashboard (persistent)                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  ╔══════════════════════════════════════════════════════════╗  │ │
│ │  ║ Easy Deploy Dashboard                    [●] Running     ║  │ │
│ │  ╠══════════════════════════════════════════════════════════╣  │ │
│ │  ║                                                          ║  │ │
│ │  ║  📦 New artifact detected: todo-app                      ║  │ │
│ │  ║  🔄 Auto-deploying... [████████░░] 80%                   ║  │ │
│ │  ║  ✓ Deployed: http://localhost:3000                       ║  │ │
│ │  ║                                                          ║  │ │
│ │  ╚══════════════════════════════════════════════════════════╝  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration Patterns

#### Pattern 1: Watch Mode (Recommended)
```bash
# Terminal 1: Claude Code session
claude-code

# Terminal 2: Easy Deploy in watch mode
easy-deploy watch
# Monitors ./artifacts folder for changes
# Auto-deploys new/updated artifacts
# Shows live status
```

#### Pattern 2: Claude Code Slash Command
```bash
# In Claude Code, create custom command:
# .claude/commands/deploy.md
Deploy the current artifact using Easy Deploy:
- Add artifact from ./artifacts
- Deploy to Docker
- Show deployment URL
```

#### Pattern 3: Integrated CLI Commands
```bash
# Claude Code can call Easy Deploy directly:
You: "Deploy this app"
Claude: *runs* easy-deploy add-artifact --source ./my-app && easy-deploy deploy
```

#### Pattern 4: Background Daemon Mode
```bash
# Start Easy Deploy as daemon
easy-deploy daemon start

# Claude Code session works normally
# Easy Deploy monitors and auto-deploys in background
# Access dashboard anytime: easy-deploy dashboard

# Stop daemon
easy-deploy daemon stop
```

### Example Workflows

#### Workflow A: Generate → Deploy → Iterate
```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Generate with Claude Code                            │
├──────────────────────────────────────────────────────────────┤
│ You: "Create a blog app with React"                          │
│ Claude: *generates in ./artifacts/blog-app*                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Easy Deploy Auto-Detects (Watch Mode)                │
├──────────────────────────────────────────────────────────────┤
│ Easy Deploy: "New artifact detected: blog-app"               │
│ Easy Deploy: "Type detected: React"                          │
│ Easy Deploy: "Deploy? [Y/n]"                                 │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 3: One-Click Deploy                                     │
├──────────────────────────────────────────────────────────────┤
│ ✓ Docker image built                                         │
│ ✓ Containers started                                         │
│ ✓ App running: http://localhost:3000                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Iterate in Claude Code                               │
├──────────────────────────────────────────────────────────────┤
│ You: "Add dark mode to the blog"                             │
│ Claude: *updates code*                                       │
│ Easy Deploy: "Changes detected, redeploying..."              │
│ Easy Deploy: "✓ Updated: http://localhost:3000"              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Smart Overview Dashboard

### Current State
- Dashboard launches with generic layout
- Doesn't check for existing deployments
- No auto-detection of configuration state

### New Concept: Intelligent Overview

```
╔════════════════════════════════════════════════════════════════════╗
║ Easy Deploy Dashboard                              v1.0.0          ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  OVERVIEW - System Status                                          ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  Configuration:  ✓ Found (easy-deploy.config.js)                  ║
║  Docker:         ✓ Running (Docker Desktop 4.25.0)                ║
║  Database:       ✓ Connected (SQLite: ./data/app.db)              ║
║  Deployment:     ● RUNNING                                         ║
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ 📦 my-todo-app                                               │ ║
║  │ ├─ Type: React                                               │ ║
║  │ ├─ Status: Running                                           │ ║
║  │ ├─ URL: http://localhost:3000                                │ ║
║  │ ├─ Uptime: 2h 34m                                            │ ║
║  │ └─ Last Deploy: 2024-11-17 13:45                             │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  Quick Actions:                                                    ║
║  [1] 🌐 Open in Browser      [5] 📊 View Logs                     ║
║  [2] 🔄 Redeploy             [6] ⚙️  Settings                     ║
║  [3] ⏸️  Stop                 [7] 📦 Add Artifact                  ║
║  [4] 🗑️  Remove               [8] ❌ Exit                          ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Detection States & Flows

#### State 1: First Launch (No Config)
```
╔════════════════════════════════════════════════════════════════════╗
║ Easy Deploy - Welcome!                                             ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  👋 Welcome to Easy Deploy!                                        ║
║                                                                    ║
║  No configuration found. Let's get started!                        ║
║                                                                    ║
║  Scanning current directory...                                     ║
║  ✓ Found: package.json (Node.js project)                          ║
║  ✓ Found: artifacts/ (3 artifacts detected)                       ║
║  ⚠ Docker: Not running (please start Docker Desktop)              ║
║                                                                    ║
║  What would you like to do?                                        ║
║                                                                    ║
║  → [1] Quick Setup (recommended)                                   ║
║    [2] Manual Configuration                                        ║
║    [3] Import Existing Project                                     ║
║    [4] Exit                                                        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

#### State 2: Config Found, Not Deployed
```
╔════════════════════════════════════════════════════════════════════╗
║ Easy Deploy - Ready to Deploy                                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Configuration: my-app                                             ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  ✓ Config loaded                                                   ║
║  ✓ Docker running                                                  ║
║  ✓ Source found: ./artifacts/my-app                               ║
║  ⚠ Not deployed yet                                                ║
║                                                                    ║
║  Ready to deploy "my-app"!                                         ║
║                                                                    ║
║  → [D] Deploy Now                                                  ║
║    [C] Configure Settings                                          ║
║    [V] View Configuration                                          ║
║    [Q] Quit                                                        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

#### State 3: Running & Healthy
```
╔════════════════════════════════════════════════════════════════════╗
║ Easy Deploy - Running                                  ● LIVE      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  📦 my-app                      http://localhost:3000 ↗           ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  Status:    ● Running           CPU: ▁▂▃▃▂▁ 12%                   ║
║  Health:    ✓ Healthy           Memory: ████░░░░ 245MB            ║
║  Uptime:    2h 34m              Requests: 1,234                    ║
║                                                                    ║
║  Containers (3):                                                   ║
║  ├─ app         ● Running  [12m CPU] [245MB RAM]                  ║
║  ├─ nginx       ● Running  [2m CPU]  [45MB RAM]                   ║
║  └─ postgres    ● Running  [5m CPU]  [128MB RAM]                  ║
║                                                                    ║
║  Recent Activity:                                                  ║
║  [13:45] ✓ Deployment completed                                   ║
║  [13:44] ℹ Building Docker image...                               ║
║  [13:42] ℹ Starting deployment                                    ║
║                                                                    ║
║  [R] Restart  [S] Stop  [L] Logs  [M] Monitor  [Q] Quit           ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

#### State 4: Error State
```
╔════════════════════════════════════════════════════════════════════╗
║ Easy Deploy - Configuration Error                     ⚠ ERROR     ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ⚠️  Configuration Issues Detected                                  ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  ✗ Docker not running                                              ║
║    → Please start Docker Desktop                                   ║
║                                                                    ║
║  ✗ Missing environment variables in .env:                          ║
║    → GOOGLE_CLIENT_ID                                              ║
║    → GOOGLE_CLIENT_SECRET                                          ║
║                                                                    ║
║  ⚠ Artifact source not found:                                      ║
║    → ./artifacts/my-app (directory doesn't exist)                 ║
║                                                                    ║
║  Auto-Fix Available:                                               ║
║  → [F] Fix Issues Automatically                                    ║
║    [M] Manual Fix Guide                                            ║
║    [R] Reconfigure                                                 ║
║    [Q] Quit                                                        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 4. Missing Modules & Implementation Audit

### Module Status Matrix

```
┌────────────────────────┬──────────┬───────────┬──────────────────┐
│ Module                 │ Status   │ Priority  │ Dependencies     │
├────────────────────────┼──────────┼───────────┼──────────────────┤
│ bin/easy-deploy.js     │ ✓ DONE   │ Critical  │ -                │
│ lib/wizard.js          │ ✓ DONE   │ Critical  │ inquirer         │
│ lib/deploy.js          │ ⚠ PARTIAL│ Critical  │ docker, db, git  │
│ lib/docker.js          │ ⚠ PARTIAL│ Critical  │ dockerode        │
│ lib/database.js        │ ✓ DONE   │ High      │ better-sqlite3   │
│ lib/git.js             │ ✓ DONE   │ High      │ simple-git       │
│ lib/auth.js            │ ✓ DONE   │ Medium    │ passport         │
│ lib/providers/         │ ✓ DONE   │ High      │ -                │
│ lib/ui/dashboard.js    │ ⚠ PARTIAL│ Critical  │ blessed          │
│ lib/ui/components.js   │ ✓ DONE   │ High      │ blessed          │
│ lib/ui/themes.js       │ ✓ DONE   │ Medium    │ -                │
├────────────────────────┼──────────┼───────────┼──────────────────┤
│ MISSING MODULES:       │          │           │                  │
├────────────────────────┼──────────┼───────────┼──────────────────┤
│ lib/config-detector.js │ ✗ TODO   │ Critical  │ fs-extra         │
│ lib/health-checker.js  │ ✗ TODO   │ High      │ axios            │
│ lib/watch-mode.js      │ ✗ TODO   │ High      │ chokidar         │
│ lib/daemon.js          │ ✗ TODO   │ Medium    │ pm2/node-daemon  │
│ lib/auto-fixer.js      │ ✗ TODO   │ Medium    │ various          │
│ lib/monitoring.js      │ ✗ TODO   │ Low       │ dockerode        │
│ server/app.js          │ ✗ TODO   │ Critical  │ express          │
│ server/routes/         │ ✗ TODO   │ Critical  │ express          │
│ server/middleware/     │ ✗ TODO   │ High      │ express          │
└────────────────────────┴──────────┴───────────┴──────────────────┘

Legend:
✓ DONE    - Fully implemented
⚠ PARTIAL - Started but incomplete
✗ TODO    - Not yet implemented
```

### Critical Missing Components

#### 1. Config Detection System
**File:** `lib/config-detector.js`

**Purpose:** Auto-detect project state and guide users

**ASCII Flow:**
```
Start Dashboard
      ↓
Check for easy-deploy.config.js
      ↓
   ┌──┴──┐
   NO   YES
   │     │
   │     ├─→ Load config
   │     ├─→ Validate config
   │     ├─→ Check Docker
   │     ├─→ Check deployment status
   │     └─→ Show Overview
   │
   ├─→ Scan directory
   ├─→ Detect artifacts
   ├─→ Detect package.json
   ├─→ Check Docker
   └─→ Show Welcome/Setup
```

#### 2. Health Checker
**File:** `lib/health-checker.js`

**Purpose:** Monitor deployment health in real-time

**Features:**
- Container status checks
- HTTP endpoint health checks
- Resource usage monitoring
- Automatic restart on failure

#### 3. Watch Mode
**File:** `lib/watch-mode.js`

**Purpose:** Monitor artifacts folder for changes

**ASCII Concept:**
```
┌─────────────────────────────────────────┐
│ Watch Mode Active                       │
│ Monitoring: ./artifacts                 │
├─────────────────────────────────────────┤
│                                         │
│ [14:23] File added: artifacts/new-app/  │
│         → Auto-deploying...             │
│ [14:24] ✓ Deployed: http://localhost:3001│
│                                         │
│ [14:35] File changed: artifacts/app/index.js│
│         → Rebuilding...                 │
│ [14:36] ✓ Updated: http://localhost:3000 │
│                                         │
│ Press [Ctrl+C] to stop watching         │
└─────────────────────────────────────────┘
```

#### 4. Express Server (Missing!)
**Files:** `server/app.js`, `server/routes/`, `server/middleware/`

**Purpose:** Actual web application that gets deployed

**Structure:**
```
server/
├── app.js                 # Express app setup
├── routes/
│   ├── auth.js           # OAuth routes
│   ├── artifacts.js      # Artifact CRUD
│   ├── deployments.js    # Deployment API
│   └── health.js         # Health check endpoint
├── middleware/
│   ├── auth.js           # Auth middleware
│   ├── error.js          # Error handling
│   └── logging.js        # Request logging
└── views/
    └── dashboard.html    # Web UI (optional)
```

**Critical Issue:** The current system deploys Docker containers but there's no actual Express server to run inside them!

---

## 5. Implementation Plan

### Phase 1: Core Fixes (Week 1)
**Priority: CRITICAL**

1. **Create Express Server Template**
   - `server/app.js` - Basic Express setup
   - Health check endpoint
   - Static file serving
   - Database connection

2. **Fix Dashboard Overview**
   - `lib/config-detector.js` - Auto-detection
   - Update `lib/ui/dashboard.js` - Smart states
   - Add health checking to overview

3. **Fix CLI Commands**
   - Make dashboard truly default
   - Update README with correct commands
   - Add npm scripts for dev/prod

### Phase 2: Integration (Week 2)
**Priority: HIGH**

1. **Watch Mode**
   - `lib/watch-mode.js`
   - File system monitoring
   - Auto-deploy on changes
   - Integration with dashboard

2. **Health Monitoring**
   - `lib/health-checker.js`
   - Real-time status updates
   - Container metrics
   - Alert system

3. **Auto-Fixer**
   - `lib/auto-fixer.js`
   - Detect common issues
   - Suggest fixes
   - One-click repair

### Phase 3: Advanced Features (Week 3+)
**Priority: MEDIUM**

1. **Daemon Mode**
   - Background process
   - Persistent monitoring
   - API for control

2. **Claude Code Integration**
   - Custom slash commands
   - MCP integration
   - Workflow examples

3. **Web Dashboard**
   - Browser-based UI
   - Real-time updates via WebSockets
   - Multi-deployment management

---

## 6. Next Steps - Before Implementation

### Required for Each New Module:

1. **Concept Spec** (like this document)
   - Purpose and scope
   - ASCII mockups
   - User flows
   - API design

2. **Technical Design**
   - Class/function signatures
   - Dependencies
   - Error handling
   - Testing strategy

3. **Integration Plan**
   - How it connects to existing modules
   - Breaking changes
   - Migration path

4. **User Documentation**
   - Usage examples
   - Configuration
   - Troubleshooting

### Approval Process:

```
1. Create CONCEPT.md section → Review
2. Create DESIGN.md for module → Review
3. Implement module → Review
4. Integration test → Review
5. Update docs → Merge
```

---

## Current Priorities (Ordered)

1. ✅ **Fix CLI commands** (Update README, make dashboard default)
2. 🔴 **Create Express server template** (CRITICAL - apps can't run without this!)
3. 🟡 **Implement config-detector.js** (Better UX)
4. 🟡 **Update dashboard.js with smart states** (Better UX)
5. 🟢 **Add watch-mode.js** (Claude Code integration)
6. 🟢 **Document Claude Code workflows** (User guide)

---

**Created by StarsMedia.com**
