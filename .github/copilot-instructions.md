# Copilot Instructions for Secret Santa

## Project Overview
Multilingual Secret Santa gift exchange app built with React + Vite frontend and Azure Functions API, deployed on Azure Static Web Apps with Cosmos DB.

## Environment Strategy
- **PR**: Ephemeral resource group per PR (`secretsanta-pr-{number}`) with Free tier resources
- **QA**: Isolated resource group (`secretsanta-qa`) with Free tier for cost-effective testing
- **Production**: Production resource group (`secretsanta`) with production-ready tiers

| Environment | Resource Group | Static Web App | Cosmos DB | Email |
|-------------|---------------|----------------|-----------|-------|
| PR | `secretsanta-pr-{n}` | Free | Serverless | ❌ |
| QA | `secretsanta-qa` | Free | Free Tier | ✅ |
| Production | `secretsanta` | Standard | Serverless | ✅ |

Each environment has its own isolated resources. All environments auto-configure: Cosmos DB, App Insights, ACS (email for QA/Prod).

Note: Staging environments are ENABLED in Static Web Apps to support GitHub Actions deployments via deployment token.

## Project Structure
```
secretsanta/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   └── ui/            # shadcn/ui components
│   ├── lib/               # Utilities, types, translations
│   └── hooks/             # Custom React hooks
├── api/                   # Azure Functions backend
│   └── src/
│       ├── functions/     # HTTP endpoints
│       └── shared/        # Cosmos DB, email, telemetry
├── e2e/                   # Playwright E2E tests
├── infra/                 # Bicep infrastructure
│   ├── main.bicep         # Main template
│   ├── parameters.dev.json    # PR environments
│   ├── parameters.qa.json     # QA environment (isolated in secretsanta-qa RG)
│   └── parameters.prod.json   # Production
├── docs/                  # Documentation
│   ├── getting-started.md # Local development guide
│   ├── github-deployment.md # CI/CD setup guide
│   ├── development.md     # Overview & navigation
│   ├── quick-reference.md # Command reference
│   ├── CONTRIBUTING.md    # Contribution guidelines
│   └── SECURITY.md        # Security policy
├── docker-compose.yml     # Local emulator setup
└── .github/workflows/     # CI/CD pipeline
```

## Key Patterns

### Frontend
- **View Navigation**: `App.tsx` manages view state (no router)
- **i18n**: `LanguageProvider` context + `useLanguage()` hook
- **Translations**: All in `src/lib/translations.ts`
- **State**: `useLocalStorage` hook for client-side persistence

### API
- **Runtime**: Azure Functions v4 with TypeScript
- **Database**: Azure Cosmos DB (serverless)
- **Email**: Azure Communication Services (optional)
- **Telemetry**: Application Insights via `api/src/shared/telemetry.ts`
- **Routes**:
  - `POST /api/games` - Create game (validates date is today or future)
  - `GET /api/games/{code}` - Get game
  - `PATCH /api/games/{code}` - Update game
  - `DELETE /api/games/{code}` - Delete game (requires organizerToken)
  - `POST /api/email/send` - Send emails
  - `GET /api/health` - Full health check
  - `GET /api/health/live` - Liveness probe
  - `GET /api/health/ready` - Readiness probe
- **Timer Triggers**:
  - `cleanupExpiredGames` - Runs daily at 2:00 AM UTC, deletes games 3+ days past event date

### Adding Translations
```typescript
// src/lib/translations.ts
export const translations = {
  es: { newKey: "Spanish text" },
  en: { newKey: "English text" }
}
// Usage: const { t } = useLanguage(); t('newKey')
```

### Creating API Functions
```typescript
// api/src/functions/{name}.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { trackError, trackEvent } from '../shared/telemetry'

export async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = crypto.randomUUID()
  
  try {
    // Implementation
    trackEvent('EventName', { requestId })
    return { status: 200, jsonBody: { success: true } }
  } catch (error) {
    trackError(error as Error, 'functionName', { requestId })
    return { status: 500, jsonBody: { error: 'Internal error' } }
  }
}

app.http('functionName', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'your-route',
  handler
})
```

### Error Handling Pattern
```typescript
import { ApiErrorCode, createErrorResponse, trackError } from '../shared/telemetry'

// In catch block:
trackError(error, 'functionName', { requestId, gameCode })
return createErrorResponse(ApiErrorCode.DATABASE_ERROR, 'Failed to save game')
```

## Development

### Local Development (Docker + VS Code)
```bash
# Install dependencies
npm install && cd api && npm install && cd ..

# Start Docker emulators
docker-compose up -d

# VS Code: Press F5 → "🚀 Full Stack (Frontend + API + Emulators)"
# Starts frontend (localhost:5173) and API (localhost:7071) with debugger attached
```

### Testing
```bash
cd api && npm test             # API unit tests
npm run test:e2e               # E2E tests
npm run test:e2e:ui            # E2E with UI
```

### Documentation
Comprehensive guides available in the `docs/` folder:
- **Getting Started** - Local development setup, Docker emulator configuration, debugging
- **GitHub Deployment** - CI/CD pipeline details, Azure resource provisioning, service principal setup
- **Quick Reference** - Command reference, git workflow, deployment procedures
- **Contributing** - Development workflow and contribution guidelines
- **API Reference** - HTTP endpoint documentation with request/response examples

## Infrastructure

### GitHub Secrets (CI/CD Authentication)
Only ONE secret is needed:
| Secret | Value | Description |
|--------|-------|-------------|
| `AZURE_CREDENTIALS` | JSON (5 fields) | Complete service principal credentials with appId, tenant, subscriptionId, password, displayName |

**No GitHub variables needed** - Resource group names and URLs are determined dynamically.

### Resource Group Naming
All resource groups are **created automatically** by the CI/CD workflow:
- **PR Deployments**: `secretsanta-pr-{PR_NUMBER}` (created automatically, deleted when PR closes)
- **QA Environment**: `secretsanta-qa` (created automatically on first push to main)
- **Production**: `secretsanta` (created automatically on first push to main)

### Manual Deployment (Optional)
If you need to deploy manually outside the CI/CD workflow:
```bash
# Deploy QA environment (creates RG if needed)
az group create --name secretsanta-qa --location centralus
az deployment group create \
  --resource-group secretsanta-qa \
  --template-file infra/main.bicep \
  --parameters infra/parameters.qa.json deploymentId=qa-stable

# Deploy Production environment (creates RG if needed)
az group create --name secretsanta --location centralus
az deployment group create \
  --resource-group secretsanta \
  --template-file infra/main.bicep \
  --parameters infra/parameters.prod.json deploymentId=prod-stable
```

### Environment Variables (Auto-configured by Bicep)
| Variable | Description |
|----------|-------------|
| `COSMOS_ENDPOINT` | Cosmos DB endpoint |
| `COSMOS_KEY` | Cosmos DB key |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights |
| `ACS_CONNECTION_STRING` | Email service |
| `APP_BASE_URL` | Application URL (from Static Web App output) |
| `ENVIRONMENT` | pr/qa/prod |

## Domain Logic
- **Game Code**: 6-digit numeric string
- **Assignments**: Circular shuffle (each gives to next)
- **Reassignment**: Preserves cycle integrity
- **Date Validation**: Games can only be created for today or future dates
- **Data Retention**: Games auto-deleted 3 days after event date
- **Manual Deletion**: Organizers can delete games anytime via DELETE endpoint

## Frontend Views
- `home` - Landing page with game code entry and privacy link
- `create-game` - Game creation form with date validation
- `game-created` - Success page with organizer token
- `select-participant` - Participant login for protected games
- `assignment` - Shows gift assignment
- `organizer-panel` - Full game management (includes delete feature)
- `privacy` - Data handling and retention policy
- `game-not-found` - Error page for deleted/invalid games

## Types
Types in `src/lib/types.ts` and `api/src/shared/types.ts` - keep in sync manually.
