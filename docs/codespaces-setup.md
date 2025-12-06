# GitHub Codespaces Setup Guide

This project is fully configured for GitHub Codespaces! You can develop entirely in the browser without installing anything locally.

## Quick Start (30 seconds)

1. **Fork the repository** on GitHub (or open from main repo)
2. **Create a Codespace:**
   - Click **"Code"** → **"Codespaces"** → **"Create codespace on main"**
   - Wait ~60 seconds for container to build
3. **Start Full-Stack Development:**
   - Press **F5** in VS Code (browser-based)
   - Full-stack launcher runs: Docker containers start, API debugger attaches
4. **Open Frontend:**
   - Click the notification when port 5173 opens
   - Or navigate to: `https://{your-codespace}.github.dev`
5. **Debug:**
   - Set breakpoints in TypeScript
   - Inspect database via VS Code extension
   - View logs in terminal

## What's Included

### Environment
- **Node.js 20** - JavaScript/TypeScript runtime
- **Docker-in-Docker** - Run containers inside Codespace
- **Azure CLI** - Manage Azure resources
- **GitHub CLI** - Git operations
- **Azure Dev CLI (azd)** - Infrastructure tools

### Pre-Installed Extensions
- **Azure Functions** - Deploy and manage functions
- **Cosmos DB** - Browse and query database
- **Azure Static Web Apps** - Deploy frontend
- **Tailwind CSS** - CSS preview
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitLens** - Git integration
- **GitHub Copilot** - AI assistance

### Automatic Setup
On container creation, the setup process automatically:
1. Installs npm dependencies for frontend and API
2. Creates `api/local.settings.json` with correct emulator settings
3. Configures Docker to run Cosmos DB + Azurite emulators

✅ **Zero manual configuration needed!**

## Workflow

### Full-Stack Debugging (F5)
1. Press **F5** or use menu: **Run** → **Start Debugging**
2. Selects: **🚀 Full Stack (Frontend + API + Emulators)**
3. Automatically starts:
   - Docker containers (Cosmos DB on 8081, Azurite on 10000)
   - npm watch (TypeScript compilation)
   - Azure Functions runtime (localhost:7071)
   - Browser-based Vite dev server (localhost:5173)

### Port Forwarding
Ports automatically exposed to the browser:
- **5173** (Frontend) - Automatically opens browser
- **7071** (API) - Accessible via `http://localhost:7071`
- **8081** (Cosmos DB) - Internal only
- **10000** (Azurite) - Internal only

### Creating/Testing Features
```bash
# Terminal 1: Start debugger (F5)
# This handles everything below automatically

# OR manually in separate terminals:
docker-compose up -d          # Start containers
npm install && cd api && npm install  # Install deps
npm run watch                 # TypeScript compilation
cd api && npm start           # Azure Functions runtime
cd .. && npm run dev          # Frontend dev server
```

### Testing
```bash
cd api && npm test             # API unit tests
npm run test:e2e               # E2E tests
npm run test:e2e:ui            # E2E tests with browser UI
```

### Database Inspection
1. **Via VS Code Extension:**
   - Open **Azure Cosmos DB** extension in sidebar
   - Right-click → **"Attach Database Account"**
   - Enter: `https://localhost:8081`
   - Key: `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDL5eW8=` (default emulator key)
   - Browse collections, query data, edit documents

2. **Via Azure Storage Explorer:**
   - Download [Azure Storage Explorer](https://azure.microsoft.com/features/storage-explorer/)
   - Attach: `http://localhost:10000`
   - View Blob, Queue, Table storage

## Stopping/Restarting

### Pause Codespace
- Click **VS Code** menu → **Stop Codespace**
- Your environment is saved, containers stopped
- Restart anytime: Container resumes in ~30 seconds

### Delete Codespace
- GitHub Settings → **Codespaces** → Delete codespace
- All local changes lost (same as deleting a branch)
- Create new one anytime to start fresh

## Troubleshooting

### "Docker command not found"
- Container is still building
- Wait a few seconds and try again
- Check Terminal → "Local History" for setup logs

### "Port 8081 in use"
- Cosmos DB container didn't start
- Run: `docker-compose up -d`
- Check logs: `docker-compose logs cosmos-db`

### "Cannot connect to database"
- API is still retrying connection (normal)
- Wait 10-15 seconds, refresh browser
- Check Terminal for connection attempts

### "npm ERR!"
- Dependencies didn't install properly
- Run: `npm install && cd api && npm install`
- Then press F5 again

### Settings.json missing
- Container creation failed
- Run in terminal: `node scripts/setup-local-settings.js`
- Then press F5

### VS Code slowness
- Container might need more resources
- Close unused tabs and extensions
- Codespaces has 2 CPU cores by default

## Performance Tips

1. **Use 4-core machine** instead of 2-core if available
2. **Close unused VS Code extensions** in Codespaces
3. **Use built-in terminal** instead of multiple terminals
4. **Stop Codespace** when not developing to save compute hours
5. **Don't keep large containers open** - Docker-in-Docker uses host resources

## Advanced: Custom Configuration

### Add VS Code Extensions
Edit `.devcontainer/devcontainer.json`:
```json
"extensions": [
  "ms-azuretools.vscode-azurefunctions",
  "YOUR_NEW_EXTENSION_ID"  // Add here
]
```

### Increase Resources
GitHub Codespaces settings → Machine type: **8-core** (for intense development)

### Use External Database
1. Create real Cosmos DB in Azure
2. Update `COSMOS_ENDPOINT` and `COSMOS_KEY` in `api/local.settings.json`
3. Restart: `docker-compose down` then F5

## What Happens Behind the Scenes

1. **GitHub creates container** from `.devcontainer/devcontainer.json`
   - Base image: Node 20
   - Adds Docker-in-Docker feature
   - Installs Azure/GitHub CLIs
   - Installs VS Code extensions

2. **postCreateCommand runs** (one time):
   - `npm install` - Frontend dependencies
   - `cd api && npm install` - API dependencies
   - Auto-generates `api/local.settings.json`

3. **You press F5:**
   - VS Code runs task: `full-stack-start`
   - Task starts Docker containers: Cosmos DB + Azurite
   - Task starts npm watch (TypeScript files)
   - Task starts Azure Functions runtime
   - Task attaches debugger

4. **Browser opens:**
   - Vite dev server serves frontend
   - Frontend API calls go to http://localhost:7071
   - Breakpoints work in both frontend and API code

## Billing

GitHub Codespaces uses compute hours:
- **Free tier:** 60 hours/month (included with GitHub account)
- **2-core machine:** ~1 hour compute per 1 hour usage
- **4-core machine:** ~2 hours compute per 1 hour usage
- **Stop codespace** when not developing to save hours
- [Check usage](https://github.com/settings/billing/overview)

## See Also
- [Getting Started](getting-started.md) - Local development
- [Quick Reference](quick-reference.md) - Common commands
- [API Reference](api-reference.md) - Endpoints documentation
- [Contributing](../CONTRIBUTING.md) - Development workflow

