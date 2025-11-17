# Easy Deploy

> Provider-agnostic deployment tool for Claude artifacts and web apps with Docker, GitHub integration, and beautiful terminal UI

Easy Deploy streamlines the deployment of web applications, with special support for Claude-generated artifacts. Deploy static sites, React apps, and more to your server with Docker, complete with database, OAuth authentication, and automated Git workflows.

## Features

- **Provider-Agnostic Architecture** - Works with Claude artifacts, local files, GitHub repos, or any URL
- **Beautiful Terminal UI** - Interactive dashboard built with blessed for monitoring and control
- **Multiple Artifact Types** - Auto-detects React, HTML, Markdown, Vue, Svelte, and more
- **Docker Integration** - Automatic Docker Compose and Dockerfile generation
- **Database Support** - SQLite (default) or PostgreSQL with automatic migrations
- **Google OAuth** - Built-in authentication with passport.js
- **Git Automation** - Semantic commits, auto-commit workflows, and GitHub integration
- **CRUD per User** - Multi-user support with per-user artifact management
- **Flexible Workflows**:
  - Local Development - Test before deploying
  - Talking Git Commits - Auto-commit with semantic messages
  - Live Release - Deploy directly to production
  - Full CI/CD - Code, test, commit, release workflow

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/gbechtold/Easy-Deploy.git
cd Easy-Deploy

# Install dependencies
npm install

# Link for global use (optional)
npm link
```

### Initialize a New Project

```bash
# Run the setup wizard
easy-deploy init

# Or with options
easy-deploy init --name my-app --provider claude
```

The wizard will guide you through:
- Project name and configuration
- Artifact provider selection
- Server and deployment settings
- Database choice (SQLite/PostgreSQL)
- OAuth configuration
- Workflow mode selection

### Deploy Your Application

```bash
# Launch interactive dashboard
easy-deploy

# Or quick deploy without UI
easy-deploy deploy

# Or use the quick command
easy-deploy quick
```

## Workflows

### 1. Local Development

Test your application locally before deploying to production.

```bash
easy-deploy init --workflow local
easy-deploy deploy
```

### 2. Talking Git Commits

Automatically commit changes with semantic commit messages.

```bash
easy-deploy init --workflow git
# Auto-commits will happen based on file changes
```

### 3. Live Release

Deploy immediately to production with every change.

```bash
easy-deploy init --workflow live
easy-deploy deploy
```

### 4. Full CI/CD Workflow

Complete workflow: Code → Test → Commit → Release

```bash
easy-deploy init --workflow full
easy-deploy deploy
```

## Commands

### Core Commands

- `easy-deploy` - Launch interactive terminal dashboard
- `easy-deploy init` - Initialize new deployment project
- `easy-deploy deploy` - Deploy application to server
- `easy-deploy quick` - Quick deploy without interactive UI
- `easy-deploy status` - Check deployment status

### Artifact Management

```bash
# Add a new artifact
easy-deploy add-artifact --source ./my-app --type react

# Add from URL
easy-deploy add-artifact --source https://github.com/user/repo --type auto
```

### Git Operations

```bash
# Commit with auto-generated message
easy-deploy git

# Commit with custom message
easy-deploy git --message "feat: add new feature"

# Commit and push
easy-deploy git --push
```

### Database Operations

```bash
# Run migrations
easy-deploy db --migrate

# Seed database
easy-deploy db --seed

# Reset database
easy-deploy db --reset
```

## Configuration

### easy-deploy.config.js

Generated automatically by `easy-deploy init`:

```javascript
module.exports = {
  name: 'my-app',
  id: 'abc123',
  provider: 'auto', // auto, claude, local, url
  source: './artifacts',

  github: {
    enabled: true,
    repository: 'https://github.com/user/repo'
  },

  server: {
    host: 'localhost',
    port: 3000
  },

  database: 'sqlite', // or 'postgresql'

  auth: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/callback'
    }
  },

  workflow: 'local', // local, git, live, full

  features: {
    crud: true,
    autoCommit: false,
    autoDeploy: false
  },

  docker: {
    enabled: true,
    composeFile: 'docker-compose.yml'
  }
};
```

### Environment Variables (.env)

```bash
# Project
PROJECT_NAME=my-app
NODE_ENV=development

# Server
SERVER_HOST=localhost
SERVER_PORT=3000

# Database
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/app.db

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session
SESSION_SECRET=your_random_secret_here

# GitHub (optional)
GITHUB_REPOSITORY=user/repo
GITHUB_TOKEN=your_token_here
```

## Providers

### Claude Provider (Default)

Deploy artifacts generated by Claude (Anthropic):

```javascript
{
  provider: 'claude',
  source: './my-claude-artifact'
}
```

Auto-detects React, HTML, and other artifact types.

### Local Provider

Deploy from local filesystem:

```javascript
{
  provider: 'local',
  source: '/path/to/your/app'
}
```

### URL Provider

Deploy from any URL or GitHub repository:

```javascript
{
  provider: 'url',
  source: 'https://github.com/user/repo'
}
```

Supports:
- GitHub repositories
- ZIP files
- Direct file URLs

## Database

### SQLite (Default)

Zero configuration, perfect for getting started:

```javascript
{
  database: 'sqlite'
}
```

Database file stored in `./data/app.db`

### PostgreSQL

For production deployments:

```javascript
{
  database: 'postgresql'
}
```

Automatically starts PostgreSQL container with Docker Compose.

### Database Schema

Easy Deploy creates the following tables:
- `users` - User accounts (Google OAuth)
- `artifacts` - Uploaded artifacts per user
- `deployments` - Deployment history and logs
- `sessions` - User sessions

## Docker Integration

### Auto-Generated Files

Easy Deploy generates optimized Docker configurations:

- **Dockerfile** - Multi-stage build for efficient images
- **docker-compose.yml** - Complete stack with app, database, nginx
- **nginx.conf** - Reverse proxy with SSL and caching

### Docker Commands

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Profiles

Conditional services using Docker Compose profiles:

- `postgres` - PostgreSQL database
- `nginx` - Nginx reverse proxy
- `redis` - Redis cache

```bash
# Start with specific profiles
docker-compose --profile postgres --profile nginx up -d
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Client Secret to `.env`

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Terminal UI

The interactive dashboard provides:

- **Project Info** - Configuration and status
- **Deployment Status** - Real-time container status
- **Quick Actions** - Deploy, Git, Database, OAuth configuration
- **Progress Bar** - Visual deployment progress
- **Activity Log** - Real-time logs with color coding

### Keyboard Shortcuts

- `↑/↓` - Navigate actions
- `Enter` - Select action
- `q` / `Esc` - Exit dashboard
- `Ctrl+C` - Force quit

## Project Structure

```
Easy-Deploy/
├── bin/
│   └── easy-deploy.js          # CLI entry point
├── lib/
│   ├── ui/
│   │   ├── dashboard.js        # Terminal dashboard
│   │   ├── components.js       # UI components
│   │   └── themes.js           # Color themes
│   ├── providers/
│   │   ├── index.js            # Provider interface
│   │   ├── claude.js           # Claude provider
│   │   ├── local.js            # Local provider
│   │   └── url.js              # URL provider
│   ├── wizard.js               # Setup wizard
│   ├── deploy.js               # Deployment logic
│   ├── docker.js               # Docker operations
│   ├── database.js             # Database management
│   ├── git.js                  # Git automation
│   └── auth.js                 # OAuth configuration
├── templates/
│   ├── docker-compose.yml      # Docker Compose template
│   ├── Dockerfile              # Dockerfile template
│   └── nginx.conf              # Nginx configuration
└── package.json
```

## Examples

### Deploy a React App

```bash
easy-deploy init
# Choose: React, Local provider
# Source: ./my-react-app

easy-deploy deploy
```

### Deploy Claude Artifact

```bash
easy-deploy init
# Choose: Auto-detect provider
# Source: ./claude-chat-app

easy-deploy deploy
```

### Deploy from GitHub

```bash
easy-deploy init
# Choose: URL provider
# Source: https://github.com/user/awesome-app

easy-deploy deploy
```

## Troubleshooting

### Docker not running

```bash
# Start Docker Desktop or Docker daemon
# Then retry deployment
```

### Port already in use

```bash
# Change port in .env or easy-deploy.config.js
SERVER_PORT=3001
```

### OAuth not working

```bash
# Verify credentials in .env
# Check redirect URI in Google Console matches:
http://localhost:YOUR_PORT/auth/google/callback
```

### Database migration errors

```bash
# Reset database
easy-deploy db --reset

# Run migrations again
easy-deploy db --migrate
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

Created by Guntram Bechtold

Built with:
- [blessed](https://github.com/chjj/blessed) - Terminal UI
- [Docker](https://www.docker.com/) - Containerization
- [Passport.js](http://www.passportjs.org/) - OAuth authentication
- [simple-git](https://github.com/steveukx/git-js) - Git automation

## Links

- [Repository](https://github.com/gbechtold/Easy-Deploy)
- [Issues](https://github.com/gbechtold/Easy-Deploy/issues)
- [Claude](https://claude.ai) - AI assistant that can generate artifacts

---

**Made with Claude Code** 🤖
