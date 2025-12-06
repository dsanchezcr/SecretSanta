# 🛠️ Local Development Setup

This document explains how the local development environment is automatically configured when you clone the repository and run it locally, in GitHub Codespaces, or in any development environment.

## Overview

When you set up Secret Santa locally, the system automatically creates and configures everything needed for development:

- ✅ Database connection (`local.settings.json`)
- ✅ Environment variables
- ✅ Docker containers
- ✅ Development servers
- ✅ Debuggers

**Zero manual configuration needed!** Just run the app.

---

## Automatic Setup Workflow

### 1. Local Development (Your Machine)

When you clone and run the app locally:

```bash
# Clone the repo
git clone https://github.com/dsanchezcr/secretsanta.git
cd secretsanta

# Option A: Use root setup script (recommended)
npm run setup

# Option B: Start normally (setup runs automatically)
cd api && npm install
npm run dev
```

**What happens:**
- `setup-local-settings.js` automatically runs
- Copies `local.settings.json.example` → `local.settings.json`
- Configures for local Cosmos DB emulator
- Dependencies installed
- Ready to start with `npm run dev` or `F5` in VS Code

### 2. GitHub Codespaces

When you open the repo in Codespaces:

```bash
# Codespaces automatically runs the postCreateCommand
# which includes:
npm install && cd api && npm install && cp local.settings.json.example local.settings.json
```

**What happens:**
- Dev container starts with all extensions pre-installed
- Dependencies installed automatically
- `local.settings.json` created from template
- Docker containers configured in devcontainer
- Ready to develop immediately!

### 3. CI/CD & Production Deployments

When deployed to Azure:

```bash
# CI/CD workflow runs
npm run build
npm run test:e2e

# Deployment
# Azure Static Web Apps provides app settings automatically
# local.settings.json is NEVER used
```

**What happens:**
- Local settings file is ignored (`.gitignore`)
- Azure provides real credentials via app settings
- No risk of accidentally using local emulator in production
- Each environment (PR/QA/Prod) gets its own credentials

---

## File Structure

### What's Committed to Git

```
api/
├── local.settings.json.example    ✅ COMMITTED (template only)
└── local.settings.json            ❌ .gitignore (auto-generated)
```

### Why This Matters

- **`local.settings.json.example`** - Template that's safe to commit
  - Shows what configuration is available
  - Contains non-sensitive defaults
  - Used to generate actual settings

- **`local.settings.json`** - Never committed
  - Your personal development setup
  - Contains secrets/keys for your machine
  - Generated automatically for each developer
  - Safe to modify for local testing

---

## Configuration Details

### Generated local.settings.json

When the setup script runs, it creates this configuration:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    
    "COSMOS_ENDPOINT": "https://localhost:8081",
    "COSMOS_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "COSMOS_DATABASE_NAME": "secretsanta",
    "COSMOS_CONTAINER_NAME": "games",
    
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "",
    "ACS_CONNECTION_STRING": "",
    
    "APP_BASE_URL": "http://localhost:5173",
    "ENVIRONMENT": "local"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

### Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `COSMOS_ENDPOINT` | `https://localhost:8081` | Local emulator URL |
| `COSMOS_KEY` | Default key | Emulator uses public, non-secret key |
| `COSMOS_DATABASE_NAME` | `secretsanta` | Database name |
| `COSMOS_CONTAINER_NAME` | `games` | Container name |
| `APP_BASE_URL` | `http://localhost:5173` | Frontend URL |
| `ENVIRONMENT` | `local` | Development mode |

**Security Note:** The Cosmos DB emulator key is a public, well-known default. It's only for development and provides no real security. Never put this key anywhere near production!

---

## Setup Scripts

### Root Setup Script

**File:** `npm run setup`

```bash
npm run setup
```

**Does:**
1. Runs `scripts/setup-local-settings.js`
2. Checks if `local.settings.json` exists
3. If not, copies from `.example` file
4. Installs API dependencies
5. Shows status message

### API Setup Hook

**File:** `api/package.json` - `"preinstall"` script

```json
"scripts": {
  "setup": "node ../scripts/setup-local-settings.js",
  "preinstall": "npm run setup"
}
```

**Does:**
- Runs before `npm install` in the `api/` folder
- Automatically creates `local.settings.json` if missing
- Runs silently (doesn't interrupt workflow)

### Devcontainer Setup

**File:** `.devcontainer/devcontainer.json`

```json
"postCreateCommand": "npm install && cd api && npm install && cp local.settings.json.example local.settings.json 2>/dev/null || true"
```

**Does:**
- Runs when Codespaces container is created
- Installs root and API dependencies
- Copies settings template to actual file
- Silent failure if file already exists (`|| true`)

---

## Workflow: First Time Running Locally

### Step 1: Clone

```bash
git clone https://github.com/dsanchezcr/secretsanta.git
cd secretsanta
```

**Result:**
- Repository cloned
- `local.settings.json` does NOT exist yet
- `local.settings.json.example` exists

### Step 2: Install Root Dependencies

```bash
npm install
```

**Result:**
- Root `node_modules/` installed
- Setup script copied to `scripts/`

### Step 3: Start with F5 or npm

**Option A: VS Code F5 (Recommended)**
```bash
# Press F5 in VS Code
# or Ctrl+Shift+D → click play button
```

**Option B: Manual Start**
```bash
npm run setup    # Creates local.settings.json
docker-compose up -d  # Start containers
npm run dev      # Start frontend
cd api && npm install && npm start  # Start API
```

**Result:**
- Setup script creates `local.settings.json`
- Docker containers start
- Frontend: `http://localhost:5173`
- API: `http://localhost:7071`
- Cosmos DB: `https://localhost:8081`
- Everything connected and working!

### Step 4: Start Coding

```bash
# Make changes to src/ or api/src/
# Changes auto-reload
# Add breakpoints and debug
```

---

## Troubleshooting

### "local.settings.json not found"

**Solution:** Run setup manually

```bash
npm run setup
```

Then verify file exists:
```bash
ls api/local.settings.json
```

### "Database Unavailable"

**Causes:**
1. Docker containers not running
2. Cosmos DB emulator not healthy
3. `local.settings.json` missing or misconfigured

**Solution:**

```bash
# 1. Check Docker
docker-compose ps

# 2. Start if needed
docker-compose up -d

# 3. Check health
docker-compose logs cosmosdb-emulator

# 4. Recreate settings
npm run setup
```

### "Can't connect to emulator certificate"

**Cause:** Browser trust issue with self-signed certificate

**Solution (Windows/macOS):**
```bash
# Import certificate
docker-compose exec cosmosdb-emulator curl -k https://localhost:8081 > /dev/null
```

Or ignore for local development (browser will warn but work).

### Settings file is encrypted

**Old Setup:** If you had an encrypted `local.settings.json` from an older version:

```bash
# Delete the old file
rm api/local.settings.json

# Recreate from template
npm run setup
```

---

## Environment-Specific Behavior

### Local Development

```
local.settings.json → Points to emulator
                   → Uses local database
                   → Email disabled
                   → Useful for testing
```

### GitHub Codespaces

```
.devcontainer → Creates local.settings.json
              → Same as local development
              → All dependencies pre-installed
              → Press F5 to start debugging
```

### Production (Azure)

```
CI/CD Pipeline → Ignores local.settings.json
              → Uses Azure app settings
              → Real Cosmos DB endpoint
              → Real email service
              → Cannot access local settings file
```

### Why This Works

- `local.settings.json` is in `.gitignore`
- Never pushed to git
- Azure Functions reads from `app settings` in Static Web Apps instead
- Each environment completely isolated

---

## For Open Source Contributors

When you contribute to this project:

1. **Clone and setup** - Automatic, no special steps
2. **Make changes** - Local settings already configured
3. **Test locally** - Works perfectly with emulator
4. **Create PR** - Your `local.settings.json` never leaves your computer
5. **CI/CD tests** - Automatic testing in clean environment

Everything is automatically isolated. Your local development setup is personal to you and never interferes with:
- Other developers' setups
- GitHub Actions CI/CD
- Production deployments

---

## Advanced: Customizing Local Settings

If you need to change something for testing:

```bash
# Edit your local settings
nano api/local.settings.json
```

Common customizations:

```json
{
  "Values": {
    "COSMOS_ENDPOINT": "https://localhost:8081",  // Change emulator address
    "COSMOS_KEY": "YOUR_KEY_HERE",                 // Use real Azure for testing
    "ACS_CONNECTION_STRING": "YOUR_ACS",           // Enable email testing
    "ENVIRONMENT": "testing"                       // Change to test mode
  }
}
```

**Note:** Changes are local to your machine. Run `git restore api/local.settings.json` to revert to default.

---

## Summary

| Scenario | Setup Process | Result |
|----------|---------------|--------|
| **Local Clone** | `npm install` → setup script auto-runs | ✅ Ready to code |
| **GitHub Codespaces** | Container `.postCreateCommand` auto-runs | ✅ Ready to code |
| **CI/CD Pipeline** | Ignores local settings | ✅ Uses Azure credentials |
| **Production** | Never uses local.settings.json | ✅ Complete isolation |

Everything is **automatic, isolated, and safe** for open source! 🎉
