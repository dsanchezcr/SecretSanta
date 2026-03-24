# Contributing to Secret Santa

Thank you for your interest in contributing! 🎁

## ✅ Prerequisites

Make sure you have installed:
- Node.js 20+ (`node --version`)
- Docker Desktop (`docker --version`)
- Git (`git --version`)
- VS Code with **Azure Functions** extension

See [README.md](../README.md) for detailed setup.

## 🚀 Quick Setup (All Platforms - Windows, macOS, Linux)

```bash
# 1. Clone your fork
git clone https://github.com/YOUR_USERNAME/secretsanta.git
cd secretsanta

# 2. Start Docker containers (runs Cosmos DB emulator)
docker-compose up -d

# 3. Open in VS Code
code .
```

**In VS Code:**
- Press `F5` to open the Debug menu
- Select **"🚀 Full Stack (Frontend + API + Emulators)"**
- Press Enter or click the play button
- Frontend opens at `http://localhost:5173` ✨
- API runs on `http://localhost:7071`

**Automatic Setup:**
- `local.settings.json` is automatically created from the template
- Database configured for local emulator
- No manual npm install or configuration needed!

For details, see [Local Development Setup](docs/local-development-setup.md).

## 📋 Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes** following the code style

3. **Test your changes**:
   ```bash
   npm run lint           # Lint check
   cd api && npm test     # API unit tests
   npm run test:e2e       # E2E tests
   ```

4. **Commit** with clear messages:
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue"
   ```

5. **Push and create PR** to `main`

## 📁 Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | React frontend |
| `src/components/` | UI components |
| `src/lib/` | Utilities, types, translations |
| `api/src/functions/` | Azure Functions endpoints |
| `api/src/shared/` | Shared code (DB, email) |
| `e2e/` | Playwright E2E tests |
| `infra/` | Bicep infrastructure |

## 🌐 Adding Translations

1. Open `src/lib/translations.ts`
2. Add your key to both `es` and `en` objects:
   ```typescript
   export const translations = {
     es: { newKey: "Texto en español" },
     en: { newKey: "English text" }
   }
   ```
3. Use in components:
   ```tsx
   const { t } = useLanguage()
   return <span>{t('newKey')}</span>
   ```

## 🧪 Testing Guidelines

- **API tests**: Located in `api/src/__tests__/` (248+ tests across 13 suites)
- **E2E tests**: Located in `e2e/` (runs on Chromium, Firefox, and WebKit)
- **Accessibility**: E2E tests include automated axe-core WCAG 2.0 AA checks
- **Type validation**: Run `npm run validate:types` to ensure frontend/API types stay in sync
- Run tests before submitting PRs
- Add tests for new features

## 🔒 Security Guidelines

- Use `crypto.randomUUID()` / `crypto.randomInt()` — never `Math.random()`
- Use `safeCompare()` for all token comparisons
- Enforce input length limits via `INPUT_LIMITS` in `api/src/shared/types.ts`
- Never expose `error.message` in API responses

## 💡 Code Style

- Use TypeScript
- Follow existing patterns
- Use Tailwind CSS for styling
- Keep components small and focused

## 🔄 CI/CD

PRs automatically get:
- Lint and build checks
- Unit tests
- E2E tests (Chromium, Firefox, WebKit)
- Accessibility checks
- Preview deployment

## ❓ Questions?

Open an issue or start a discussion!

````

