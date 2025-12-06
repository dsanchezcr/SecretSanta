# Deployment Guide

## Environment Strategy

This project uses an ephemeral infrastructure approach:

| Environment | Resource Group | Lifecycle | Purpose |
|-------------|----------------|-----------|---------|
| **PR** | `secretsanta-pr-{number}` | Created on PR open, deleted on close | Isolated testing per PR |
| **QA** | `secretsanta-qa` | Persistent | Pre-production validation (isolated) |
| **Production** | `secretsanta` | Persistent | Live environment |

### How It Works

1. **Pull Request Opened**: Creates a dedicated resource group with full infrastructure
2. **PR Updated**: Re-deploys to the same PR environment
3. **PR Merged/Closed**: Deletes the entire resource group (cleanup)
4. **Push to main**: Deploys QA → runs E2E → deploys Production

### Auto-Configured Environment Variables

All environments automatically receive these settings from infrastructure:

| Variable | Description |
|----------|-------------|
| `COSMOS_ENDPOINT` | Cosmos DB endpoint |
| `COSMOS_KEY` | Cosmos DB primary key |
| `COSMOS_DATABASE_NAME` | Database name |
| `COSMOS_CONTAINER_NAME` | Container name |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | App Insights key |
| `APP_BASE_URL` | Static Web App URL |
| `ACS_CONNECTION_STRING` | Email service (if enabled) |
| `ACS_SENDER_ADDRESS` | Email sender (if enabled) |

## Prerequisites

- Azure subscription ([create free](https://azure.microsoft.com/free/))
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) installed
- GitHub account with repository access

## Initial Setup

### 1. Create Azure Service Principal

```bash
# Login to Azure
az login

# Create service principal for GitHub Actions (OIDC)
az ad sp create-for-rbac --name "secretsanta-github" \
  --role contributor \
  --scopes /subscriptions/{subscription-id} --json-auth
```

**Save the entire JSON output** - you'll need all 5 fields including `subscriptionId`.

### 2. Configure GitHub Secret

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Complete JSON output from the command above (all 5 fields) |

### 3. Configure GitHub Environments

Go to **Settings → Environments** and create:

| Environment | Protection Rules |
|-------------|------------------|
| `preview` | None |
| `qa` | None |
| `production` | Required reviewers |
| `infrastructure` | Required reviewers |

### 4. Create Production Resource Group

```bash
# Create production resource group
az group create --name secretsanta --location centralus

# Create QA resource group (isolated from production)
az group create --name secretsanta-qa --location centralus
```

### 5. Create Infrastructure (Optional)

Just push to the repository:

- **Open a PR**: Full infrastructure created automatically
- **Push to main**: Staging → E2E → Production

## Manual Infrastructure Deployment

For initial setup or manual deployment:

```bash
# Deploy PR environment
az deployment group create \
  --resource-group secretsanta-pr-123 \
  --template-file infra/main.bicep \
  --parameters environment=pr prNumber=123

# Deploy QA (isolated resource group)
az group create --name secretsanta-qa --location centralus
az deployment group create \
  --resource-group secretsanta-qa \
  --template-file infra/main.bicep \
  --parameters infra/parameters.qa.json

# Deploy Production
az deployment group create \
  --resource-group secretsanta \
  --template-file infra/main.bicep \
  --parameters infra/parameters.prod.json
```

## Enable Email Notifications

Email is enabled by default in QA and production. For PR environments:

```bash
az deployment group create \
  --resource-group secretsanta-pr-123 \
  --template-file infra/main.bicep \
  --parameters environment=pr prNumber=123 enableEmailService=true
```

## Infrastructure Resources

| Resource | PR | QA | Production |
|----------|:--:|:--:|:----------:|
| Static Web App (Free) | ✅ | ✅ | - |
| Static Web App (Standard) | - | - | ✅ |
| Cosmos DB (Serverless) | ✅ | - | ✅ |
| Cosmos DB (Free Tier) | - | ✅ | - |
| Application Insights | ✅ | ✅ | ✅ |
| Log Analytics | ✅ | ✅ | ✅ |
| Communication Services | ❌ | ✅ | ✅ |

## Infrastructure Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `projectName` | secretsanta | Base name for resources |
| `environment` | pr | Environment (pr/qa/prod) |
| `prNumber` | - | PR number (required for pr env) |
| `staticWebAppSku` | Free | SWA tier (Free/Standard) |
| `enableEmailService` | false | Enable Azure Communication Services |
| `emailDataLocation` | United States | Email data residency |
| `repositoryUrl` | - | GitHub repo URL |
| `repositoryBranch` | main | Git branch |

## Cleanup

### Delete PR Environment (automatic on PR close)

```bash
az group delete --name secretsanta-pr-123 --yes --no-wait
```

### Delete All Environments

```bash
# Delete production
az group delete --name secretsanta --yes

# Delete QA
az group delete --name secretsanta-qa --yes

# Delete any orphaned PR environments
az group list --query "[?starts_with(name, 'secretsanta-pr-')].name" -o tsv | \
  xargs -I {} az group delete --name {} --yes --no-wait
```

## Monitoring

### Application Insights

Each environment has its own Application Insights instance. Access via:
- Azure Portal → Resource Group → Application Insights
- Or use the instrumentation key from the deployment outputs

### Health Checks

- `GET /api/health` - Full diagnostics
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe (checks DB)

## Data Retention

### Automatic Cleanup

A timer-triggered Azure Function runs daily at **2:00 AM UTC** to clean up expired games:

- **Retention Policy**: Games are automatically deleted 3 days after their event date
- **Function**: `cleanupExpiredGames` in `api/src/functions/cleanupExpiredGames.ts`
- **Schedule**: CRON expression `0 0 2 * * *`

### Manual Deletion

Organizers can delete their games at any time:

```
DELETE /api/games/{code}?organizerToken={token}
```

### Privacy Considerations

- No data is shared with third parties
- All game data is stored in Azure Cosmos DB (serverless)
- Users can view the Privacy page in the application for full details
- Game deletion is irreversible
