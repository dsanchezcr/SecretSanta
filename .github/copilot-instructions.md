# Copilot Instructions for Secret Santa

## Project Overview
Multilingual Secret Santa gift exchange app built with React + Vite frontend and Azure Functions API, deployed on Azure Static Web Apps with Cosmos DB. Features PWA support, dark mode, QR code sharing, calendar integration, and hardened security (crypto-secure randomness, timing-safe token comparison, rate limiting, strict CSP).

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
│   ├── lib/               # Utilities, types, translations, calendar, sharing
│   ├── hooks/             # Custom React hooks (dark mode, localStorage, mobile)
│   └── styles/            # CSS theme (light/dark mode support)
├── api/                   # Azure Functions backend
│   └── src/
│       ├── functions/     # HTTP endpoints
│       ├── shared/        # Cosmos DB, email, telemetry, rate limiter
│       └── __tests__/     # Unit tests (Jest, 248+ tests)
├── e2e/                   # Playwright E2E tests (Chromium, Firefox, WebKit)
├── infra/                 # Bicep infrastructure
│   ├── main.bicep         # Main template (includes optional Managed Identity, Front Door, Budget alerts)
│   ├── parameters.dev.json    # PR environments
│   ├── parameters.qa.json     # QA environment (isolated in secretsanta-qa RG)
│   └── parameters.prod.json   # Production
├── public/                # PWA manifest, service worker, static assets
├── scripts/               # Utility scripts (type validation, setup)
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
- **View Navigation**: `App.tsx` manages view state with hash-based routing (`#create`) and path-based routing (`/privacy`, `/organizer-guide`, `/participant-guide`) for browser back button support
- **i18n**: `LanguageProvider` context + `useLanguage()` hook
- **Translations**: Split into per-language files under `src/lib/translations/` (en.ts, es.ts, etc.)
- **State**: `useLocalStorage` hook for client-side persistence
- **Dark Mode**: `useDarkMode` hook + `DarkModeToggle` component on all pages, toggles `.dark-theme` class on `<html>`
- **PWA**: `public/manifest.json` + `public/sw.js` service worker with cache-first strategy
- **QR Codes**: `QRCodeDisplay` component using `qrcode` library for invitation links (with invite-only label)
- **Calendar**: `generateICS()` / `downloadICS()` in `src/lib/calendar-utils.ts` for `.ics` downloads
- **Event Countdown**: `EventCountdown` component with live timer updates and localized time units
- **Telemetry**: Frontend Application Insights via `src/lib/app-insights.ts` (fetches connection string from `/api/config` at runtime)

### API
- **Runtime**: Azure Functions v4 with TypeScript
- **Database**: Azure Cosmos DB (serverless)
- **Email**: Azure Communication Services (optional)
- **Telemetry**: Application Insights via `api/src/shared/telemetry.ts`
- **Rate Limiting**: IP-based rate limiting via `api/src/shared/rate-limiter.ts` (createGame: 10/min, sendEmail: 20/min, GET/PATCH: 60/min)
- **Security**:
  - All tokens/IDs generated with `crypto.randomUUID()` / `crypto.randomInt()`
  - Token comparisons use `safeCompare()` (timing-safe via `crypto.timingSafeEqual`)
  - Input length validation via `INPUT_LIMITS` constants in `api/src/shared/types.ts`
  - Max 100 participants per game, field lengths enforced (name: 80, notes: 2000, etc.)
- **Routes**:
  - `POST /api/games` - Create game (validates date is today or future)
  - `GET /api/games/{code}` - Get game
  - `PATCH /api/games/{code}` - Update game
  - `DELETE /api/games/{code}` - Delete game (requires organizerToken)
  - `POST /api/email/send` - Send emails
  - `POST /api/games/cleanup` - Cleanup HTTP endpoint (triggered by GitHub Actions cron, requires `x-cleanup-secret` header)
  - `GET /api/health` - Full health check
  - `GET /api/health/live` - Liveness probe
  - `GET /api/health/ready` - Readiness probe
- **Scheduled Cleanup**:
  - Azure Managed Functions do not support timer triggers. Instead, a GitHub Actions workflow calls the `/api/games/cleanup` HTTP endpoint daily at 2:00 AM UTC, which deletes games 3+ days past event date.

### Adding Translations
```typescript
// src/lib/translations/en.ts (each language has its own file)
export const en = {
  // ...
  newKey: "English text",
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
npm run validate:types         # Check frontend/API type sync
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
| `COSMOS_KEY` | Cosmos DB key (omitted when Managed Identity is enabled) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights |
| `ACS_CONNECTION_STRING` | Email service |
| `APP_BASE_URL` | Application URL (from Static Web App output) |
| `ENVIRONMENT` | pr/qa/prod |

## Domain Logic
- **Game Code**: 6-digit numeric string (crypto-secure via `crypto.randomInt`)
- **Assignments**: Circular shuffle (each gives to next) with crypto-secure Fisher-Yates algorithm
- **Exclusion Rules**: Optional pairs that should never be assigned to each other
- **Adding Participants**: Preserves confirmed participants' assignments using lock-based regeneration; shows pending assignment state when all others confirmed
- **Reassignment**: Individual reassignment for any participant from organizer panel; preserves cycle integrity
- **Date Validation**: Games can only be created for today or future dates
- **Data Retention**: Games auto-archived 3 days after event date, permanently deleted 30 days after archival (GDPR compliant)
- **Manual Deletion**: Organizers can delete games anytime via DELETE endpoint

## Frontend Views
- `home` - Landing page with game code entry, dark mode toggle, and privacy link
- `create-game` - Game creation form with date validation
- `game-created` - Success page with organizer token and QR code sharing
- `select-participant` - Participant login for protected games
- `assignment` - Shows gift assignment with event countdown and calendar download; shows pending assignment page when no assignment exists
- `organizer-panel` - Full game management with individual/bulk reassignment (includes delete feature)
- `privacy` - Data handling and retention policy
- `game-not-found` - Error page for deleted/invalid games

## Types
Types in `src/lib/types.ts` and `api/src/shared/types.ts` - keep in sync manually.
Run `npm run validate:types` to check for drift between frontend and API types.
