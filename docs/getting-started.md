# 🚀 Local Development Guide

Get up and running with Secret Santa locally in minutes. This guide covers everything you need to develop, test, and debug the application on your machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (5 minutes)](#quick-start-5-minutes)
- [Development Workflow](#development-workflow)
- [Debugging](#debugging)
- [Database Management](#database-management)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## Prerequisites

Before you start, ensure you have the following installed on your machine (**Windows, macOS, or Linux**):

### Required

- **Node.js 20+** - [Download](https://nodejs.org/)
  - Verify: `node --version`
  
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
  - Verify: `docker --version` and `docker-compose --version`
  - **Windows**: Docker Desktop for Windows
  - **macOS**: Docker Desktop for Mac
  - **Linux**: Install Docker Engine + Docker Compose separately

- **Git** - [Download](https://git-scm.com/)
  - Verify: `git --version`

- **VS Code** - [Download](https://code.visualstudio.com/)
  - Install the **Azure Functions** extension (ms-azuretools.vscode-azurefunctions)

### Optional

- **Azure Storage Explorer** - For managing local Cosmos DB
- **Azure Cosmos DB** VS Code extension - For database browsing
- **Postman/Insomnia** - For API testing

---

## Quick Start (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/dsanchezcr/secretsanta.git
cd secretsanta
```

### 2. Start Docker Containers

```bash
docker-compose up -d
```

Verify containers are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS              PORTS
cosmosdb-emulator       Up (healthy)        8081/tcp
azurite-emulator        Up (healthy)        10000-10002/tcp
```

### 3. Open VS Code and Press F5

```bash
code .
```

In VS Code:
1. Press `F5` (or Ctrl+Shift+D, then click the play button)
2. Select **"🚀 Full Stack (Frontend + API + Emulators)"**
3. Press Enter or click the green play button

✅ **What happens automatically:**
- Frontend dev server starts on `http://localhost:5173`
- API runs on `http://localhost:7071`
- Cosmos DB Emulator runs on `https://localhost:8081`
- Debugger attaches to both frontend and API
- Browser opens automatically

### 4. Start Developing

Open your browser to `http://localhost:5173` and start coding!

Changes to your code automatically hot-reload. Add breakpoints in VS Code to debug any issues.

---

## Local Settings (Automatic Setup)

### How It Works

When you clone the repo and run the app, the local database configuration is set up automatically:

1. **First-time setup** - When you run `npm install` in the `api/` folder:
   - `local.settings.json` is automatically created from `local.settings.json.example`
   - Configured to use the local Cosmos DB emulator
   - No manual steps needed!

2. **In GitHub Codespaces** - The `.devcontainer` configuration handles this automatically

3. **CI/CD & Production** - Azure Static Web Apps provides its own app settings with real credentials

### Manual Setup (If Needed)

If you need to manually create the local settings file:

```bash
npm run setup
```

This copies the example template and shows you what was configured.

### What Gets Configured

The `local.settings.json` file automatically includes:
- **COSMOS_ENDPOINT**: `https://localhost:8081` (emulator)
- **COSMOS_KEY**: Default emulator key (safe, public key)
- **COSMOS_DATABASE_NAME**: `secretsanta`
- **COSMOS_CONTAINER_NAME**: `games`
- **APP_BASE_URL**: `http://localhost:5173`
- **ENVIRONMENT**: `local`

### Security Note

⚠️ **This file is NOT committed to git** (it's in `.gitignore`):
- The example file (`local.settings.json.example`) IS committed
- Your local file stays private
- Production credentials are managed by Azure, not this file
- Safe to commit the example to open-source repos

---

## Development Workflow

### What Gets Started With F5

When you press `F5`, VS Code automatically:

1. **Starts Docker containers** (Cosmos DB + Azurite) - if not already running
2. **Installs dependencies** (npm modules) - if needed
3. **Starts the Frontend** - Vite dev server with hot reload
4. **Starts the API** - Azure Functions with hot reload
5. **Attaches debuggers** - For both frontend and API
6. **Opens your browser** - To http://localhost:5173

### Making Changes

Changes to your code **automatically hot-reload**:

- Edit `src/` files → Browser refreshes automatically
- Edit `api/src/` files → API restarts automatically
- No need to manually restart anything!

### Adding Breakpoints

Add breakpoints anywhere in your code:
1. Click the line number to add a red dot
2. Trigger the code (refresh page or call API)
3. Execution pauses at the breakpoint
4. Use Debug panel to step through code

### View Logs

- **Frontend logs**: Browser DevTools (F12 → Console)
- **API logs**: VS Code Debug Console (Ctrl+Shift+Y)
- **API requests**: Network tab in DevTools

### Environment Variables

Local development automatically uses `api/local.settings.json`:
- Cosmos DB points to emulator (`https://localhost:8081`)
- Email is disabled
- App base URL is `http://localhost:5173`

**Automatic Setup:** The first time you run `npm install` in the `api/` folder, `local.settings.json` is automatically created from `local.settings.json.example`. No manual configuration needed!

If you need to recreate it, run:
```bash
npm run setup
```

No configuration needed for basic development!

---

## Debugging

### Add Breakpoints

1. **Click any line number** in VS Code to add a red breakpoint dot
2. **Trigger the code** (refresh page, click button, or call API)
3. **Execution pauses** at your breakpoint
4. **Step through code** using the Debug toolbar:
   - Step Over (F10) - Execute next line
   - Step Into (F11) - Enter function calls
   - Step Out (Shift+F11) - Exit current function
   - Continue (F5) - Resume execution

### View Variables

In the Debug panel (Ctrl+Shift+D):
- **Variables** tab - See local variables and their values
- **Watch** tab - Monitor specific expressions
- **Call Stack** - See which functions called which

### View Logs

- **Frontend Console**: Press F12 in browser → Console tab
- **API Logs**: VS Code Debug Console (Ctrl+Shift+Y)
- **Network Requests**: Browser DevTools → Network tab

### Common Issues

**"API returns 404"**
- Check Azure Functions are running in VS Code Terminal
- Verify route name in `api/src/functions/yourFunction.ts`
- Check CORS in `api/local.settings.json`

**"Cosmos DB connection error"**
- Run `docker-compose ps` to verify containers are running
- Cosmos DB should show "healthy" status
- If stuck, restart: `docker-compose restart cosmos-db`

**"Frontend can't find API"**
- Check base URL in `src/lib/api.ts` - should be `http://localhost:7071`
- Check browser Network tab for failed API requests
- Verify API is actually running (check VS Code Debug Console)

**"Changes aren't showing up"**
- Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS)
- Check VS Code terminal for build errors
- Restart debugging: Shift+F5 then F5

---

---

## Database Management

### Cosmos DB Emulator

The local Cosmos DB Emulator is automatically set up and data persists in Docker volume `cosmos-db-data`.

#### View Data

**Option 1: Azure Storage Explorer (GUI)**

1. Install [Azure Storage Explorer](https://azure.microsoft.com/features/storage-explorer/)
2. Connect to local Cosmos DB:
   - Click "Connect" → "Cosmos DB Emulator"
   - Port: `8081`
3. Browse databases and containers

**Option 2: VS Code Extension**

1. Install [Azure Cosmos DB](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb) extension
2. Click Cosmos icon in sidebar
3. "Attach Database Account" → select emulator
4. Browse collections

**Option 3: REST API**

```bash
# Query games collection
curl -X GET "https://localhost:8081/dbs/secretsanta/colls/games/docs" \
  -H "Authorization: type%3Dmaster%26ver%3D1.0%26sig%3D..." \
  -H "x-ms-version: 2018-12-31" \
  -k  # Ignore SSL for emulator
```

#### Reset Database

To start fresh (delete all data):

```bash
# Stop and remove volume
docker-compose down -v

# Restart (creates fresh database)
docker-compose up -d cosmos-db
```

---

## Testing

### Unit Tests (API)

Run Jest tests for Azure Functions:

```bash
# Run all tests
cd api && npm test

# Run specific test file
npm test cosmosdb.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

Tests automatically use local Cosmos DB via `local.settings.json`.

### E2E Tests (Frontend)

Run Playwright tests against local app:

```bash
# First, ensure app is running (local server)
npm run test:e2e

# Run with UI mode (recommended for debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/app.spec.ts

# View last test report
npm run test:e2e:report
```

**Note:** Make sure Vite dev server is running (`http://localhost:5173`) before running E2E tests.

### Manual Testing Checklist

- [ ] Create a game (fill form, submit)
- [ ] Join a game with participant code
- [ ] View gift assignment
- [ ] View organizer panel
- [ ] Test language toggle (all 9 languages)
- [ ] Test on mobile (DevTools)
- [ ] Dark mode toggle
- [ ] Test protected game error with token entry
- [ ] Test invalid token error with token entry
- [ ] Test manual token entry flow (enter game code, then token separately)

---

## Troubleshooting

### "Docker Compose is not running"

**Error:** `docker-compose: command not found`

**Solution (All Platforms):**
```bash
# Docker Desktop (Windows/macOS) should auto-install
# Verify installation:
docker-compose --version

# Linux users: may need separate install
# https://docs.docker.com/compose/install/
```

### "Port 8081 is already in use"

**Error:** `Error: listen EADDRINUSE: address already in use :::8081`

**Solution:**

**Windows:**
```powershell
netstat -ano | findstr :8081
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -i :8081
kill -9 <PID>
```

**Or simply use a different port** in docker-compose.yml

### "Cosmos DB not responding"

**Error:** `Error: ECONNREFUSED 127.0.0.1:8081`

**Solution (All Platforms):**
```bash
# Check container is running
docker-compose ps

# If not, start it
docker-compose up -d cosmos-db

# Wait 30-60 seconds for emulator to initialize
# Check logs
docker-compose logs cosmos-db
```

### "npm ERR! peer dep missing"

**Error:** `npm ERR! peer dep missing: ...`

**Solution (All Platforms):**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# For API
cd api && rm -rf node_modules package-lock.json
npm install
```

### "Frontend shows blank page"

**Causes & Solutions:**

1. **Vite not running**
   - Check VS Code Terminal for errors
   - Restart debug session: Shift+F5 then F5

2. **API not responding**
   - Check Azure Functions Host is running
   - Look at VS Code Debug Console (Ctrl+Shift+Y)

3. **CORS error**
   - Check browser console (F12)
   - Verify CORS in `api/local.settings.json`

4. **Cache issue**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS)
   - Clear browser cache

### "E2E tests fail"

**Causes & Solutions:**

1. **App not running**
   ```bash
   npm run dev  # In separate terminal
   ```

2. **Tests timing out**
   - Increase timeout in `playwright.config.ts`
   - Check if API is responding

3. **Selector not found**
   - App structure may have changed
   - Update selectors in test file

---

# Or simply use a different port in docker-compose.yml
```

### "Cosmos DB not responding"

**Error:** `Error: ECONNREFUSED 127.0.0.1:8081`

**Solution:**
```bash
# Check container is running
docker-compose ps

# If not, start it
docker-compose up -d cosmos-db

# Wait 30-60 seconds for emulator to initialize
# Check logs
docker-compose logs cosmos-db
```

### "npm ERR! peer dep missing"

**Error:** `npm ERR! peer dep missing: ...`

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# For API
cd api && rm -rf node_modules package-lock.json
npm install
```

### "Frontend shows blank page"

**Causes & Solutions:**

1. **Vite not running**
   - Check VS Code Terminal
   - Restart debug session

2. **API not responding**
   - Check Functions host is running
   - Look at VS Code Debug Console

3. **CORS error**
   - Check browser console (F12)
   - Verify CORS in `api/local.settings.json`

4. **Cache issue**
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)
   - Clear browser cache

### "E2E tests fail"

**Causes & Solutions:**

1. **App not running**
   ```bash
   npm run dev  # In separate terminal
   ```

2. **Tests timing out**
   - Increase timeout in `playwright.config.ts`
   - Check if API is responding

3. **Selector not found**
   - App structure may have changed
   - Update selectors in test file

---

## Advanced Topics

### View Container Logs

View detailed logs from any container:

```bash
# Cosmos DB logs
docker-compose logs -f cosmos-db

# Azurite logs
docker-compose logs -f azurite

# Follow all logs
docker-compose logs -f
```

### Email Testing (Optional)

To enable email notifications locally:

1. Get Azure Communication Services connection string from production
2. Add to `api/local.settings.json`:
   ```json
   {
     "ACS_CONNECTION_STRING": "endpoint=https://...",
     "ACS_SENDER_ADDRESS": "noreply@...",
     "ACS_DISABLED": "false"
   }
   ```
3. Restart debugger

### Application Insights Monitoring (Optional)

Enable local telemetry:

1. Create Application Insights in Azure Portal
2. Get connection string
3. Add to `api/local.settings.json`:
   ```json
   {
     "APPLICATIONINSIGHTS_CONNECTION_STRING": "InstrumentationKey=..."
   }
   ```
4. Restart debugger

---

## Getting Help

- **Issue?** Check [GitHub Issues](https://github.com/dsanchezcr/secretsanta/issues)
- **Question?** Create a [Discussion](https://github.com/dsanchezcr/secretsanta/discussions)
- **Want to contribute?** See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Next Steps

- 📖 Read [development.md](development.md) for navigation guide
- 🚀 Learn [github-deployment.md](github-deployment.md) for CI/CD setup
- 🧪 Explore [quick-reference.md](quick-reference.md) for command reference
`````

