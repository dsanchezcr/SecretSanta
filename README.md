# 🎁 Secret Santa

Secret Santa gift exchange web application built with React + Vite, Azure Functions, and Azure Cosmos DB.

[![CI/CD](https://github.com/dsanchezcr/secretsanta/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/dsanchezcr/secretsanta/actions/workflows/ci-cd.yml)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/dsanchezcr/secretsanta?quickstart=1)

## ✨ Features

- 🌍 **Multilingual**: Full support for 9 languages - English, Spanish, Portuguese, Italian, French, Japanese, Chinese, German, and Dutch
- 🎲 **Random Assignments**: Fair circular shuffle algorithm
- 🔒 **Protected Games**: Optional participant tokens for privacy
- 📧 **Email Notifications**: Optional Azure Communication Services integration with 13+ notification types
- 🔄 **Reassignment Requests**: Participants can request new assignments
- 👤 **Organizer Panel**: Full game management for organizers
- 🗑️ **Game Deletion**: Organizers can permanently delete games
- 📅 **Date Validation**: Games can only be created for today or future dates
- 🧹 **Auto-Cleanup**: Games automatically deleted 3 days after the event
- 🔐 **Privacy Policy**: Clear data handling and retention information
- 📱 **Responsive Design**: Works on all devices
- 📊 **Application Insights**: Built-in monitoring and error tracking

## 🏗️ Environment Strategy

| Environment | Resource Group | Static Web App | Cosmos DB | Lifecycle |
|-------------|----------------|----------------|-----------|------------|
| **PR Preview** | `secretsanta-pr-{number}` | Free | Serverless | Created on PR open, deleted on close |
| **QA** | `secretsanta-qa` | Free | Free Tier | Persistent (isolated from prod) |
| **Production** | `secretsanta` | Standard | Serverless | Persistent (unlimited scaling) |

Each environment has its **own Static Web App** and **own Cosmos DB** (QA is completely isolated).
All environments are **automatically configured** with:
- Cosmos DB connection
- Application Insights
- Azure Communication Services (QA/prod)

## � Prerequisites

Before you begin, ensure you have the following installed on your system (macOS, Windows, or Linux):

### Required

- **Node.js 20+** - [Download](https://nodejs.org/)
  - Verify: `node --version` (should be v20 or higher)
  
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
  - Verify: `docker --version` and `docker-compose --version`
  - **Windows Users**: Docker Desktop for Windows recommended
  - **Linux Users**: Install Docker Engine and Docker Compose separately
  - **macOS Users**: Docker Desktop for Mac recommended

- **Git** - [Download](https://git-scm.com/)
  - Verify: `git --version`

- **VS Code** - [Download](https://code.visualstudio.com/)
  - Install extension: **Azure Functions** (ms-azuretools.vscode-azurefunctions)

### Optional (for Azure deployment)

- **Azure CLI** - [Download](https://learn.microsoft.com/cli/azure/install-azure-cli)
  - Only needed if deploying to Azure
  - Verify: `az --version`

### Verify All Prerequisites

```bash
node --version      # Should be v20+
docker --version    # Docker version
docker-compose --version  # Docker Compose version
git --version       # Git version
```

All prerequisites work the same way on **Windows, macOS, and Linux**.

---

## �🚀 Quick Start

### Option 1: Cloud Development (Recommended for Beginners)

**GitHub Codespaces** - No installation required, develop entirely in the browser:

1. Click: [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/dsanchezcr/secretsanta?quickstart=1)
2. Wait ~60 seconds for container to build
3. Press **F5** in VS Code (browser-based)
4. Click notification to open frontend in browser

✅ **Zero setup!** Everything pre-configured and running.

[📖 Full Codespaces Guide](docs/codespaces-setup.md)

### Option 2: Local Development (Docker Required)

Run everything on your machine:

```bash
# Clone repository
git clone https://github.com/dsanchezcr/secretsanta.git
cd secretsanta

# Start full-stack (Docker + API + Frontend)
npm install
cd api && npm install
cd ..
# Then press F5 in VS Code to debug, OR:
docker-compose up -d    # Start Docker containers
npm run dev             # Frontend dev server
cd api && npm start     # API in separate terminal
```

Open: http://localhost:5173

[📖 Full Local Development Guide](docs/getting-started.md)

### Option 3: Deploy to Azure

1. **Fork this repository**

2. **Configure GitHub OIDC Authentication**:
   ```bash
   # Create service principal
   az ad sp create-for-rbac --name "secretsanta-github" \
     --role contributor \
     --scopes /subscriptions/{subscription-id} --json-auth
   ```

3. **Add GitHub Secret** (Settings → Secrets):
   - `AZURE_CREDENTIALS` - Paste the entire JSON output from the command above

4. **Create Production Resource Group**:
   ```bash
   az group create --name secretsanta --location centralus
   ```

5. **Open a PR** - Full infrastructure is created automatically!

See [docs/github-deployment.md](docs/github-deployment.md) for detailed setup instructions.

### Option 2: Local Development (Windows, macOS, Linux)

The fastest way to get running is with VS Code's integrated debugger:

```bash
# 1. Clone repository
git clone https://github.com/dsanchezcr/secretsanta.git
cd secretsanta

# 2. Start Docker containers (all platforms)
docker-compose up -d

# 3. Open in VS Code
code .
```

**In VS Code:**
- Press `F5` (or Ctrl+Shift+D then click play button)
- Select **"🚀 Full Stack (Frontend + API + Emulators)"**
- App automatically opens at `http://localhost:5173`

**Or use GitHub Codespaces** (no local setup needed):
1. Fork this repository
2. Click **"Code"** → **"Codespaces"** → **"Create codespace on main"**
3. Wait for container to start
4. Press `F5` to start debugging
5. App opens at the Codespace URL

See [docs/getting-started.md](docs/getting-started.md) for detailed setup instructions.

## 📁 Project Structure

```
├── src/                 # React frontend
│   ├── components/      # UI components (views, forms, dialogs)
│   ├── lib/            # Utilities, types, translations
│   └── hooks/          # Custom React hooks
├── api/                # Azure Functions backend
│   └── src/
│       ├── functions/  # HTTP endpoints + timer triggers
│       └── shared/     # Cosmos DB, email, telemetry
├── e2e/                # Playwright E2E tests
├── infra/              # Bicep infrastructure templates
└── .github/workflows/  # CI/CD pipeline
```

### Frontend Views
- **HomeView**: Landing page with game code entry
- **CreateGameView**: Game creation form with date validation
- **GameCreatedView**: Success page with organizer token
- **ParticipantSelectionView**: Participant login for protected games
- **AssignmentView**: Shows who you're buying for
- **OrganizerPanelView**: Full game management (includes delete)
- **PrivacyView**: Data handling and retention policy
- **GameNotFoundView**: Error page for deleted/invalid games

## 🔧 Configuration

### Environment Variables (Auto-configured in Azure)

| Variable | Description | Auto-Set |
|----------|-------------|:--------:|
| `COSMOS_ENDPOINT` | Cosmos DB endpoint URL | ✅ |
| `COSMOS_KEY` | Cosmos DB primary key | ✅ |
| `COSMOS_DATABASE_NAME` | Database name | ✅ |
| `COSMOS_CONTAINER_NAME` | Container name | ✅ |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection | ✅ |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Insights key | ✅ |
| `APP_BASE_URL` | Application URL | ✅ |
| `ACS_CONNECTION_STRING` | Email service connection | ✅* |
| `ACS_SENDER_ADDRESS` | Email sender address | ✅* |
| `ENVIRONMENT` | Environment name (pr/qa/prod) | ✅ |
| `BUILD_VERSION` | Build version identifier | ✅ |
| `BUILD_DATE` | Deployment timestamp | ✅ |

*Only in QA/production with email enabled

### GitHub Secrets (Required)

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Complete JSON from `az ad sp create-for-rbac` command (includes appId, tenant, subscriptionId, password) |

### No Variables Needed

Resource group names and deployment URLs are now dynamically generated and output from the infrastructure deployment steps.

## 🧪 Testing

```bash
# API unit tests
cd api && npm test

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## 🔄 CI/CD Pipeline

| Stage | Trigger | Description |
|-------|---------|-------------|
| Build & Test | All PRs and main | Lint, build, unit tests |
| **PR Infrastructure** | PR opened | Create resource group + dedicated SWA |
| Preview | PRs | Deploy to PR Static Web App |
| **Close PR** | PR closed | Delete resource group |
| QA Infrastructure | Main merge | Deploy QA Static Web App |
| QA | Main merge | Deploy to QA |
| E2E (QA) | After QA deploy | Run E2E against QA |
| Production Infrastructure | After QA E2E | Deploy production SWA |
| Production | After E2E | Manual approval required |

## 📊 Monitoring

Each environment includes Application Insights for:
- Error tracking and diagnostics
- Performance monitoring
- Custom event logging

### Health Endpoints

- `GET /api/health` - Full diagnostics (version, uptime, dependencies)
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe (checks database)

## 🗑️ Data Retention

- **Auto-Deletion**: Games are automatically deleted 3 days after their event date
- **Manual Deletion**: Organizers can delete games at any time from the Organizer Panel
- **Privacy**: See the in-app Privacy page for full data handling details
- **No External Sharing**: Data is never shared with third parties

## 📜 License

MIT - See [LICENSE](LICENSE)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.