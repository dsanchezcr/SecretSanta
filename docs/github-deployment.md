# 🔧 GitHub Deployment & CI/CD Guide

Automate your entire deployment pipeline with GitHub Actions. This guide covers setting up service principals, configuring secrets, and understanding the complete CI/CD workflow.

## Table of Contents

- [Quick Setup (10 minutes)](#quick-setup-10-minutes)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Service Principal Setup](#service-principal-setup)
- [GitHub Configuration](#github-configuration)
- [Workflow Overview](#workflow-overview)
- [Environments Explained](#environments-explained)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

---

## Quick Setup (10 minutes)

### 1. Create Service Principal (One-time)

```bash
# Login to Azure
az login

# Create service principal for CI/CD
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd" \
  --role contributor \
  --scopes /subscriptions/{subscription-id} --json-auth
```

**Output looks like:**
```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "secretsanta-github-cicd",
  "password": "xxxxxxx~xxxxx_xxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 2. Add GitHub Secret

In your GitHub repo:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `AZURE_CREDENTIALS`
4. Value: Paste the **entire JSON output** from the service principal creation above
5. Click **Add secret**

**That's it!** One secret, no variables needed.

### 3. Set Up Environments (Optional but Recommended)

Go to **Settings** → **Environments** and create:

**Environment: `qa`**
- Set **Deployment branches** to `main` only

**Environment: `production`**
- Set **Deployment branches** to `main` only
- **Required reviewers:** Add team members for approval gate

### 4. Configure Protected Branches

In **Settings** → **Branches**:

1. Click **Add rule** for `main` branch
2. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Require code review from dismissal of stale pull request reviews**

**Recommended status checks:**
- `build` (Build & Test)
- `e2e` (E2E Tests)

**Done!** Your CI/CD pipeline is ready. 🎉

---

## Architecture

### Deployment Environments

```
Pull Request
    ↓
[Build & Test] ←─ triggers on: PR opened/updated/reopened
    ↓
[E2E Tests (Local)]
    ↓
If PASSED:
    ├─→ [Create PR Resource Group] ←─ ephemeral (auto-deleted when PR closes)
    ├─→ [Deploy PR Infrastructure] ←─ Dedicated SWA (Free), Cosmos DB (Serverless), App Insights
    ├─→ [Deploy to Preview] ←─ Static Web App (main slot, no staging)
    └─→ [PR Comment] ← shows SWA URL from Bicep output

If FAILED:
    └─→ Notify PR author

---

Push to main (after PR merged)
    ↓
[Build & Test] ←─ triggers on: push to main
    ↓
[E2E Tests (Local)]
    ↓
If PASSED:
    ├─→ [Create/Verify QA RG] ←─ auto-created (secretsanta-qa)
    ├─→ [Deploy QA Infrastructure] ←─ SWA (Free), Cosmos DB (Free Tier), Email enabled
    ├─→ [Deploy to QA] ←─ QA Static Web App URL
    │
    └─ If deployment PASSED:
        ├─→ [Create/Verify Prod RG] ←─ auto-created (secretsanta)
        ├─→ [Deploy Production Infrastructure] ←─ SWA (Standard), Cosmos DB (Serverless)
        ├─→ [Deploy to Production] ← REQUIRES APPROVAL
        └─→ [Deployment Summary] ← documents the release

If any step FAILED:
    └─→ Deployment stops, notify authors
```

---

## Prerequisites

### Azure Setup

- ✅ Azure subscription with billing enabled
- ✅ Minimum roles: **Contributor** on subscription or resource group
- ✅ Azure CLI installed (`az --version`)

### GitHub Setup

- ✅ GitHub repository (you're reading this, so you have it!)
- ✅ Admin access to repository settings (to add secrets)
- ✅ Collaborators with access for review (optional)

---

## Service Principal Setup

### What is a Service Principal?

A service principal is an identity for your CI/CD pipeline to authenticate with Azure **without passwords**. GitHub Actions uses:

- **OIDC (OpenID Connect)**: Secure, no secrets needed
- **Alternative**: Personal access token (less secure, avoid if possible)

### Create Service Principal (Detailed)

#### Option 1: Azure CLI (Recommended)

```bash
# 1. Login to Azure
az login

# 2. List subscriptions
az account list --output table

# 3. Set subscription (if multiple)
az account set --subscription "subscription-id"

# 4. Create service principal
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)
```

**Output:**
```json
{
  "appId": "12345678-1234-1234-1234-123456789012",
  "displayName": "secretsanta-github-cicd",
  "password": "xxxxx~xxxxx_xxx",
  "tenant": "87654321-4321-4321-4321-210987654321",
  "subscriptionId": "11111111-2222-3333-4444-555555555555"
}
```

**Save this entire JSON!** You'll paste it as the `AZURE_CREDENTIALS` secret in GitHub.

#### Option 2: Azure Portal

1. Go to **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Name: `secretsanta-github-cicd`
4. Click **Register**
5. Copy **Application (client) ID**
6. Go to **Certificates & secrets**
7. Click **New client secret**
8. Copy the value (not the ID)
9. Go to **Subscription** → **IAM** → **Add role assignment**
10. Assign **Contributor** role to the app

### Service Principal Permissions

Current setup uses **Contributor** role which allows:
- ✅ Create/update/delete resource groups
- ✅ Deploy Bicep templates
- ✅ Create all Azure resources
- ⚠️ Very permissive (suitable for trusted CI/CD)

**For tighter security** (advanced):

Create custom role with specific permissions:

```bash
az role assignment create \
  --assignee {appId} \
  --role "Custom CI/CD Role" \
  --scope /subscriptions/{subscription-id}
```

---

## GitHub Configuration

### Add Secret

**Location:** Settings → Secrets and variables → Actions

**Add this single secret:**

| Name | Value | Source |
|------|-------|--------|
| `AZURE_CREDENTIALS` | Complete JSON output from service principal | From `az ad sp create-for-rbac` command (all 5 fields) |

**Example value:**
```json
{
  "appId": "12345678-1234-1234-1234-123456789012",
  "displayName": "secretsanta-github-cicd",
  "password": "xxxxx~xxxxx_xxx",
  "tenant": "87654321-4321-4321-4321-210987654321",
  "subscriptionId": "11111111-2222-3333-4444-555555555555"
}
```

**That's the only secret needed!** Much simpler than before.

### Configure Environments

**Location:** Settings → Environments

#### Create `qa` Environment

1. Click **New environment**
2. Name: `qa`
3. **Deployment branches** → Select **main**
4. Optional: Add reviewers
5. Click **Configure environment**

#### Create `production` Environment

1. Click **New environment**
2. Name: `production`
3. **Deployment branches** → Select **main**
4. **Required reviewers** → Add team members
5. **Custom deployment branch policies** → Optional
6. Click **Configure environment**

**Result:** Production deployments require manual approval before proceeding.

### Protect Main Branch

**Location:** Settings → Branches

1. Click **Add branch protection rule**
2. Pattern: `main`
3. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Include administrators** (optional but recommended)

4. **Select required status checks:**
   - `build` (Build & Test job)
   - `e2e` (E2E Tests job)

**Result:** Code can't be merged to `main` without passing tests.

---

## Resource Naming Strategy

### Why Unique Names Matter

Since this is an **open-source project**, many developers will deploy their own instances to their Azure subscriptions. All Azure resource names must be **globally unique**, especially:

- **Cosmos DB accounts** (globally unique across all Azure regions)
- **Static Web Apps** (unique within Azure)
- **Azure Communication Services** (unique within Azure)

### How We Ensure Uniqueness

The Bicep template uses a **sophisticated naming strategy** that automatically generates unique names:

```bicep
# Each resource name combines:
var uniqueSuffix = uniqueString(
  resourceGroup().id,      # Your resource group
  deploymentId,            # PR number, environment, or run ID
  subscription().subscriptionId # Your subscription
)

# Results in names like:
# ss7hx5k9qm2p    (Cosmos DB - 24 char limit)
# secretsanta-qa-7hx5k9qm2p  (Static Web App)
# ss-acs-7hx5k9qm2p         (Communication Services)
```

### Environment-Specific Deployment IDs

**PR Environments:**
```
deploymentId = "pr-{PR_NUMBER}"
# Example: pr-42
# Each PR gets its own dedicated Static Web App
```

**QA & Production:**
```
deploymentId = "qa-stable" or "prod-stable"
# Stable ID ensures consistent resource names across deployments
# Each environment has its own dedicated Static Web App
```

### Developer Experience

As a developer, you don't need to do anything special:

1. Fork the repo to your account
2. Run the workflow
3. ✅ Your resources automatically get unique names
4. No naming conflicts even if 100 developers deploy simultaneously

### Example Scenarios

**Scenario 1: Alice deploys PR #42**
```
Resource Group: secretsanta-pr-42
Cosmos DB: ssa1b2c3d4e5f6g7h
Static Web App: secretsanta-pr-42-a1b2c3d4e5f
```

**Scenario 2: Bob forks the repo and deploys prod to his subscription**
```
Resource Group: secretsanta
Cosmos DB: ssx9y8z7w6v5u4t
Static Web App: secretsanta-prod-x9y8z7w6v5
(Different uniqueSuffix = no conflicts!)
```

**Scenario 3: Carol deploys QA from her fork**
```
Resource Group: secretsanta
Cosmos DB: ssk1l2m3n4o5p6q
Static Web App: secretsanta-qa-k1l2m3n4o5p
(Different uniqueSuffix = no conflicts!)
```

### What This Means for You

✅ **No more naming conflicts** - Cosmos DB, Static Web Apps, etc.  
✅ **Multiple developers can deploy simultaneously** - Each gets unique resources  
✅ **Safe for public open-source** - 100+ forks won't interfere with each other  
✅ **Automatic naming** - No manual configuration needed  

---

## Workflow Overview

### Triggers

The CI/CD workflow runs automatically in these cases:

**1. Pull Request (Any activity)**
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]
```

**Runs:** Build → Test → Deploy PR infrastructure → Preview → Comment

**2. Push to Main**
```yaml
on:
  push:
    branches: [main]
```

**Runs:** Build → Test → Deploy QA → QA Tests → Deploy Production

**3. Manual Trigger (Future)**
You can add workflow_dispatch to allow manual triggers:
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
```

### Job Timeline

#### For Pull Requests (with preview)

```
1. [1 min]  Build & Test
   └─ npm build, lint, tests

2. [3 min]  E2E Tests (Local)
   └─ Playwright against mock environment

3. [3 min]  Deploy PR Infrastructure
   └─ az group create, bicep deploy (dedicated SWA)

4. [2 min]  Deploy Preview
   └─ Static Web App (main slot)

Total: ~10 minutes
Result: SWA URL posted to PR comment ✅
```

#### For Main Branch (production deployment)

```
1. [1 min]  Build & Test
   └─ npm build, lint, tests

2. [3 min]  E2E Tests (Local)
   └─ Playwright against mock environment

3. [3 min]  Deploy QA Infrastructure
   └─ Create/verify secretsanta-qa RG, deploy free tier resources

4. [2 min]  Deploy to QA
   └─ Static Web App upload

5. [3 min]  Deploy Production Infrastructure
   └─ Deploy to secretsanta RG (Standard SWA, Serverless Cosmos DB)

6. [WAIT]   🔔 AWAITING APPROVAL 🔔
   └─ Required reviewer must approve
   └─ Review → Approve → Continue

7. [2 min]  Deploy to Production
   └─ Static Web App upload to production

Total: ~15 minutes (excluding approval wait time)
Result: App live in production ✅
```

---

## Environments Explained

### Pull Request Environment

**Purpose:** Preview changes before merge

**Resources created per PR:**
- Resource Group: `secretsanta-pr-{PR_NUMBER}`
  - Static Web App (Free SKU) with preview deployment
  - Cosmos DB (Serverless, free tier)
  - Application Insights
  - Log Analytics Workspace

**Lifecycle:**
- Created when PR opens
- Updated when new commits pushed
- **Automatically deleted** when PR closes/merges ♻️

**Access:**
- URL posted in PR comment
- Valid for lifetime of PR
- Anyone with GitHub access can view

**Costs:**
- Free tier resources mostly
- Minimal storage charges if any
- ~$0 for most PRs

### QA Environment

**Purpose:** Test against production-like infrastructure before release, completely isolated from production

**Resources:**
- Isolated Resource Group: `secretsanta-qa` (separate from production)
- Static Web App (Free SKU) - no staging slots
- Cosmos DB (Free Tier - 1000 RU/s, 25GB storage, sufficient for testing)
- Application Insights (30-day retention)
- Azure Communication Services (email enabled for full testing)

**Lifecycle:**
- Created on first deployment
- Updated on every push to `main`
- Persists indefinitely
- Completely isolated from production data

**Access:**
- URL: Unique Azure-assigned URL (from deployment output)
- Accessible to team members only (if configured)

**Costs:**
- Free Static Web App: $0/month
- Cosmos DB (Free Tier): $0/month (one free tier per subscription)
- Application Insights: ~$0-5/month (low volume)
- Azure Communication Services: ~$1/month (test emails only)

**Total QA Cost:** ~$1-6/month

### Production Environment

**Purpose:** Live application for end users

**Resources:**
- Resource Group: `secretsanta`
- Static Web App (Standard SKU) - SLA, custom domains support
- Cosmos DB (Serverless - unlimited scaling, pay per request)
- Application Insights (90-day retention)
- Azure Communication Services (email enabled)

**Lifecycle:**
- Deployed only after approval
- Persists until manually deleted
- Auto-scales based on usage

**Access:**
- Public URL: Custom domain or Azure-assigned
- Monitored continuously

**Costs:**
- Standard Static Web App: ~$9/month
- Cosmos DB (Serverless): ~$5-50/month (scales with traffic, no limits)
- Application Insights: ~$5-50/month (depends on telemetry volume)
- Azure Communication Services: $0.07 per email

**Total Production Cost:** ~$20-110/month depending on usage

---

## Best Practices

### 1. Branch Strategy

**Recommended: GitHub Flow**

```
main (production)
 ↑
 └─← pull requests (feature branches)
     └─ pr/add-translations
     └─ pr/fix-cosmos-bug
     └─ pr/update-ui
```

**Process:**
1. Create feature branch from `main`
2. Make changes, push commits
3. CI/CD runs build → tests → preview
4. Review PR comments and preview
5. Get code review (2+ reviewers recommended)
6. Merge when ready
7. CI/CD auto-deploys to QA
8. Test in QA environment
9. Manual approval triggers production deploy

### 2. Commit Messages

Use clear, semantic commit messages:

```
✅ Good:
- "feat: add French translations"
- "fix: cosmos db connection timeout"
- "docs: update local development guide"
- "test: add E2E test for language toggle"

❌ Bad:
- "Update stuff"
- "Fix bugs"
- "asdasd"
- "temp"
```

### 3. Pull Request Titles

Clear titles help with understanding changes:

```
✅ Good:
- "Add support for 9 languages including German and Dutch"
- "Fix email notification service initialization"
- "Refactor authentication logic for better security"

❌ Bad:
- "WIP"
- "Changes"
- "Stuff"
```

### 4. Environment Parity

Keep environments similar:

- **Dev** (local): Most permissive, email disabled
- **QA**: Production-like, all features enabled
- **Production**: Locked down, monitoring enabled

### 5. Monitoring & Alerting

**In Azure Portal:**

1. Go to Application Insights
2. Set up alerts for:
   - Failed requests > 5% of total
   - Server response time > 5s
   - Availability tests failing
3. Configure email/SMS notifications

### 6. Security

- ✅ Use service principals (not personal access tokens)
- ✅ Use OIDC (not passwords)
- ✅ Rotate credentials every 90 days
- ✅ Use branch protection rules
- ✅ Require code reviews
- ✅ Keep dependencies updated
- ✅ Enable Advanced Security if available

### 7. Cost Management

**Monitor spending:**
1. Go to **Cost Management + Billing** in Azure Portal
2. Set budgets and alerts
3. Review monthly costs
4. Clean up unused PR environments

**Cost saving tips:**
- Delete old PR environments manually if needed
- Use Free tier Static Web App for development
- Use Serverless Cosmos DB (pay per request)
- Monitor Application Insights costs

---

## Troubleshooting

### Workflow Fails at "Build & Test"

**Problem:** `npm: command not found`

**Solution:**
```yaml
# Verify Node version in workflow:
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # Must match package.json "engines"
```

**Problem:** `tsc: command not found`

**Solution:**
```bash
# Make sure TypeScript is in devDependencies
npm list typescript

# If missing:
npm install -D typescript
```

### Workflow Fails at "Azure Login"

**Problem:** `invalid json provided to creds parameter`

**Solution:**
1. Verify `AZURE_CREDENTIALS` secret contains valid JSON
2. Check the secret includes all 5 fields:
   - `appId`
   - `displayName`
   - `password`
   - `tenant`
   - `subscriptionId`
3. Copy-paste the entire JSON output from `az ad sp create-for-rbac` without modification

**Problem:** `The operation was not successful. Status code: 401. Error message: Authorization failed`

**Solution:**
1. Service principal may have expired (90+ days)
2. Create new service principal:
   ```bash
   az ad sp create-for-rbac \
     --name "secretsanta-github-cicd-new" \
     --role contributor \
     --scopes /subscriptions/{subscription-id}
   ```
3. Update `AZURE_CREDENTIALS` secret with new JSON
4. Delete old service principal when tested

### Workflow Fails at "Deploy Infrastructure"

**Problem:** `ERROR: The Bicep file could not be parsed`

**Solution:**
```bash
# Validate Bicep locally
az bicep build --file ./infra/main.bicep

# Check syntax
az deployment group validate \
  --resource-group secretsanta \
  --template-file ./infra/main.bicep \
  --parameters ./infra/parameters.prod.json
```

**Problem:** `Insufficient permissions for operation`

**Solution:**
```bash
# Verify service principal has Contributor role
az role assignment list \
  --assignee {appId} \
  --output table

# Grant role if missing
az role assignment create \
  --assignee {appId} \
  --role "Contributor" \
  --scope /subscriptions/{subscription-id}
```

### Workflow Fails at "Deploy to QA"

**Problem:** `Cannot read deployment token`

**Solution:**
1. Verify Static Web App exists in `secretsanta-qa` resource group
2. Check Azure CLI is authenticated with correct subscription
3. Verify step "Get Static Web App Token" succeeded

**Problem:** `401 Unauthorized`

**Solution:**
```bash
# Verify Static Web App token
az staticwebapp secrets list \
  --name secretsanta-qa \
  --resource-group secretsanta-qa

# Token should be returned successfully
```

### E2E Tests Fail in QA

**Problem:** `Timeout waiting for element`

**Solution:**
1. Check QA app is fully deployed and responsive
2. Increase Playwright timeout in `playwright.config.ts`
3. Verify workflow step "Get Static Web App Token" succeeded (base URL derives from infrastructure output)

### Production Deployment Waiting Forever

**Problem:** Deployment stuck in "Awaiting Approval"

**Solution:**
1. Go to Actions → specific workflow run
2. See "Waiting" section with "Review deployments"
3. Click "Review deployments"
4. Approve for "production"
5. Workflow continues

---

## Security

### Secrets Management

**What's stored as secrets:**
- `AZURE_CREDENTIALS` ✅ JSON containing all needed authentication info
  - `appId` (public ID)
  - `tenant` (public ID)
  - `subscriptionId` (public ID)
  - `password` (secret, only stored once, uses OIDC for authentication)

**What's NOT stored:**
- Individual client ID / tenant ID / subscription ID variables
- Connection strings ❌ Auto-generated in Azure
- API keys ❌ Auto-generated in Static Web App
- Deployment tokens ❌ Retrieved dynamically from Azure CLI during workflow

**Simpler approach:**
- Only 1 secret to manage (vs 3 before)
- All auth info in one place
- Easier to rotate (regenerate 1 secret)

### Credential Rotation

Every 90 days:

```bash
# Create new service principal
az ad sp create-for-rbac \
  --name "secretsanta-github-cicd-new" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}

# Copy entire JSON output
# Update AZURE_CREDENTIALS secret in GitHub
# Delete old service principal after testing
az ad sp delete --id {old-appId}
```

### Audit Trail

GitHub tracks all deployments:
1. Go to repo → **Deployments**
2. View who deployed what, when
3. See all environment activity

Azure tracks deployments in Activity Log:
1. Go to **Resource Group** → **Activity log**
2. Filter by Deployments
3. See all infrastructure changes

---

## Next Steps

- 📖 Read [getting-started.md](getting-started.md) for local development
- 🔗 Set up [custom domain](https://docs.microsoft.com/azure/static-web-apps/custom-domain-github-pages)
- 📊 Configure [monitoring & alerts](https://learn.microsoft.com/en-us/azure/azure-monitor/overview)
- 💰 Review [cost optimization](https://learn.microsoft.com/en-us/azure/cost-management-billing/understand-your-bill)
- 🔐 Enable [Microsoft Entra ID authentication](https://docs.microsoft.com/azure/static-web-apps/authentication-authorization)

---

## FAQ

**Q: Do I need to manually create resource groups?**
A: No, the workflow creates all resource groups automatically (PR, QA, and Production). Just add the `AZURE_CREDENTIALS` secret and push to trigger deployments.

**Q: Can I deploy to production without approval?**
A: Remove the `production` environment from settings, but NOT recommended for production code.

**Q: How do I rollback a deployment?**
A: Redeploy previous commit. GitHub Actions maintains full deployment history.

**Q: What if Azure resources are deleted accidentally?**
A: Re-deploy using the workflow. Bicep templates are idempotent (safe to run multiple times).

**Q: How do I add more team members?**
A: Go to repo → Settings → Collaborators → Add person. They'll need approval if branch protection enabled.

**Q: Can I use a different Azure subscription?**
A: Yes, recreate the service principal for the new subscription and update the `AZURE_CREDENTIALS` secret.

**Q: What if deployment tokens expire?**
A: Azure automatically regenerates them. Workflow handles this.

---

**Questions?** [Open an issue](https://github.com/dsanchezcr/secretsanta/issues) or [start a discussion](https://github.com/dsanchezcr/secretsanta/discussions).

````

