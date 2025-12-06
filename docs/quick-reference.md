# 🎯 Quick Reference - Common Commands

Handy command reference for both development and deployment.

## 🚀 Local Development

### Start Everything

```bash
# Option 1: Debug mode (recommended for development)
F5  # In VS Code

# Option 2: Manual steps
docker-compose up -d              # Start emulators
npm run dev                        # Terminal 1: Frontend
cd api && npm start                # Terminal 2: API
```

### Stop Everything

```bash
# Option 1: From VS Code
Shift+F5  # Stop debugging

# Option 2: Manual
docker-compose down               # Stop emulators
Ctrl+C                           # Stop servers
```

### Database

```bash
# View logs
docker-compose logs -f cosmos-db
docker-compose logs -f azurite

# Reset database
docker-compose down -v
docker-compose up -d

# Connect with Azure Storage Explorer
# Tools → Connect to local emulator
```

### Testing

```bash
# Unit tests (API)
cd api && npm test

# E2E tests (Frontend)
npm run test:e2e
npm run test:e2e:ui               # With UI
npm run test:e2e:report           # View report

# Build check
npm run build
cd api && npm run build

```

### Other

```bash
# Lint
npm run lint

# Install dependencies
npm install
cd api && npm install

# Watch files
npm run watch  # Frontend
cd api && npm run watch  # API
```

---

## 🔧 Deployment Commands

### Login & Setup (One-time)

```bash
# Login to Azure
az login

# Create service principal
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)

# Get subscription ID
az account show --query id -o tsv

# Get tenant ID
az account show --query tenantId -o tsv
```

### Manual Deployment

```bash
# Development
./scripts/deploy.ps1 -Environment dev       # PowerShell
./scripts/deploy.sh dev                     # Bash

# QA (isolated resource group)
./scripts/deploy.ps1 -Environment qa
./scripts/deploy.sh qa

# Production
./scripts/deploy.ps1 -Environment prod
./scripts/deploy.sh prod

# Skip login (for CI/CD)
./scripts/deploy.ps1 -Environment prod -SkipLogin
./scripts/deploy.sh prod --skip-login

# Skip build (use pre-built artifacts)
./scripts/deploy.ps1 -Environment prod -SkipBuild
./scripts/deploy.sh prod --skip-build
```

### Azure Resource Management

```bash
# List subscriptions
az account list --output table

# Set subscription
az account set --subscription "subscription-id"

# Create resource group
az group create \
  --name secretsanta \
  --location centralus

# Create QA resource group (isolated from production)
az group create \
  --name secretsanta-qa \
  --location centralus

# List resources
az group list --output table
az resource list --resource-group secretsanta --output table

# Delete resource group
az group delete --name secretsanta --yes --no-wait

# View deployment history
az deployment group list \
  --resource-group secretsanta \
  --output table
```

### Infrastructure Commands

```bash
# Validate Bicep
az bicep build --file ./infra/main.bicep

# Validate deployment
az deployment group validate \
  --resource-group secretsanta \
  --template-file ./infra/main.bicep \
  --parameters ./infra/parameters.prod.json

# Deploy QA infrastructure (isolated resource group)
az deployment group create \
  --resource-group secretsanta-qa \
  --template-file ./infra/main.bicep \
  --parameters ./infra/parameters.qa.json

# Deploy Production infrastructure
az deployment group create \
  --resource-group secretsanta \
  --template-file ./infra/main.bicep \
  --parameters ./infra/parameters.prod.json
```

---

## 📊 Monitoring & Debugging

### View Logs

```bash
# Docker container logs
docker-compose logs -f                      # All
docker-compose logs -f cosmos-db            # Just Cosmos
docker-compose logs -f azurite              # Just Azurite

# Azure Function logs (local)
# Check VS Code Debug Console (Ctrl+Shift+Y)

# Azure resources logs
az monitor activity-log list \
  --resource-group secretsanta \
  --output table

# Application Insights logs
az monitor app-insights query \
  --app insights-name \
  --analytics-query "requests | limit 100"
```

### Health Checks

```bash
# Is Cosmos DB running?
curl -k https://localhost:8081/_explorer/

# Is Azurite running?
curl http://localhost:10000/devstoreaccount1?comp=list

# Is API running?
curl http://localhost:7071/api/health

# Is Frontend running?
curl http://localhost:5173
```

### Resource Costs

```bash
# View cost analysis (monthly)
az cost management query create \
  --definition "{\"type\":\"Usage\"}" \
  --timeframe "MonthToDate" \
  --scope "/subscriptions/$(az account show --query id -o tsv)"

# Better: Use Azure Portal
# Cost Management + Billing → Cost analysis
```

---

## 🔐 Secrets & Credentials

### Create GitHub Credentials

```bash
# Create service principal and get JSON output
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}

# Copy the entire JSON output (all 5 fields including subscriptionId)
# Add to GitHub Settings → Secrets → New repository secret:
# Name: AZURE_CREDENTIALS
# Value: [paste entire JSON]
```

### Rotate Credentials

```bash
# Create new service principal
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd-new" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}

# Copy new JSON and update AZURE_CREDENTIALS secret

# Delete old service principal
az ad sp delete --id {old-app-id}
```

### Access Deployment Tokens

```bash
# These are now retrieved dynamically - no manual setup needed!
# Tokens are fetched during workflow via:

# QA environment (isolated resource group)
az staticwebapp secrets list \
  --name secretsanta-qa \
  --resource-group secretsanta-qa

# Production environment
az staticwebapp secrets list \
  --name secretsanta-prod \
  --resource-group secretsanta
```

---

## 🐛 Troubleshooting Quick Fixes

```bash
# Port already in use
# Find and kill process
lsof -i :8081
kill -9 <PID>

# Or on Windows
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# Clean npm install
rm -rf node_modules package-lock.json
npm install

# Clean Docker
docker-compose down -v
docker-compose up -d

# Clear Docker cache (aggressive)
docker system prune -a -f

# Force TypeScript rebuild
npx tsc --build --clean
npx tsc --build

# Restart Docker Desktop
# macOS: Click icon → Restart
# Windows: Settings → Reset
```

---

## 📝 Git Quick Reference

### Branching

```bash
# Create feature branch
git checkout -b feat/your-feature
git checkout -b fix/bug-name
git checkout -b docs/update-readme

# Switch branches
git checkout main
git checkout -

# Delete branch (local)
git branch -d feat/your-feature

# Delete branch (remote)
git push origin --delete feat/your-feature
```

### Commits

```bash
# Check status
git status

# Stage changes
git add .
git add path/to/file

# Commit
git commit -m "feat: add new feature"
git commit -m "fix: resolve cosmos issue"
git commit -m "docs: update readme"
git commit -m "test: add e2e test"

# Amend last commit
git commit --amend --no-edit
git commit --amend -m "new message"

# View history
git log --oneline
git log --oneline --graph --all
```

### Sync & Push

```bash
# Update from remote
git fetch
git pull

# Push to remote
git push origin feat/your-feature

# Force push (careful!)
git push --force-with-lease origin feat/your-feature
```

### Review & Merge

```bash
# View diffs
git diff                          # Unstaged
git diff --cached                 # Staged
git diff main...feat/your-feature # Feature vs main

# Merge PR (command line)
git checkout main
git pull
git merge feat/your-feature
git push origin main

# Better: Use GitHub UI for PR merge
```

---

## 🚀 CI/CD Pipeline Reference

### Monitor Workflows

```bash
# View workflow runs
gh run list --workflow ci-cd.yml

# Watch specific run
gh run view <run-id> --log

# Check workflow file syntax
gh workflow view ci-cd.yml

# Trigger workflow manually (if enabled)
gh workflow run ci-cd.yml -f environment=prod
```

### Deployment Status

```bash
# Check recent deployments
az deployment group list \
  --resource-group secretsanta \
  --query "[].{name:name, time:properties.timestamp, state:properties.provisioningState}" \
  --output table

# Detailed deployment info
az deployment group show \
  --resource-group secretsanta \
  --name <deployment-name>
```

---

## 💡 Pro Tips

### Save Time

```bash
# Create aliases
alias dcu='docker-compose up -d'
alias dcl='docker-compose logs -f'
alias dcd='docker-compose down'
alias npm-api='cd api && npm'

# Use them
dcu
dcl cosmos-db
npm-api test
```

### Faster Rebuilds

```bash
# Only rebuild what changed
npm run build          # Incremental
cd api && npm run watch  # Continuous

# Don't rebuild everything
# Avoid: npm run clean && npm run build
# Instead: npm run build (already incremental)
```

### Better Debugging

```bash
# Use console logs strategically
console.log('DEBUG:', variable)  # Frontend
console.info('INFO:', message)   # API

# Then search logs
docker-compose logs | grep DEBUG
# Or in VS Code Output → Debug Console

# Use VS Code Debugger instead
# Click breakpoint → better than console.log
```

---

## 📚 More Help

- 🏠 [README.md](../README.md) - Project overview
- 📖 [getting-started.md](getting-started.md) - Local development
- 🔧 [github-deployment.md](github-deployment.md) - CI/CD setup
- 📋 [development.md](development.md) - Full guides overview
- 🏗️ [architecture.md](architecture.md) - Technical details
- 📡 [api-reference.md](api-reference.md) - API endpoints

````
