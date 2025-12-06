// ============================================================================
// Secret Santa - Infrastructure as Code
// ============================================================================
// Infrastructure for Secret Santa gift exchange app
// 
// Environment Strategy:
// - PR: Ephemeral resource group per PR (auto-deleted on close)
//       - Static Web App: Free tier
//       - Cosmos DB: Serverless (pay per request)
//       - Email Service: Disabled
//
// - QA: Isolated resource group (`secretsanta-qa`)
//       - Static Web App: Free tier
//       - Cosmos DB: Free tier (one per subscription, sufficient for testing)
//       - Email Service: Enabled (for full testing)
//
// - Prod: Production resource group (`secretsanta`)
//       - Static Web App: Standard tier (SLA, custom domains)
//       - Cosmos DB: Serverless (unlimited scaling, pay per request)
//       - Email Service: Enabled
//
// Note: Staging environments are ENABLED to support GitHub Actions deployments.
//       When deploying via deployment token (not linked repository), the action
//       requires staging environment support to properly deploy content.
//
// Resources: Static Web App, Cosmos DB, Application Insights, Azure Communication Services
// ============================================================================

@description('Project name used for resource naming')
param projectName string = 'secretsanta'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Environment: pr, qa, or prod')
@allowed(['pr', 'qa', 'prod'])
param environment string = 'pr'

@description('PR number for ephemeral environments (required for pr environment)')
param prNumber string = ''

@description('Static Web App SKU')
@allowed(['Free', 'Standard'])
param staticWebAppSku string = 'Free'

@description('Enable email notifications via Azure Communication Services')
param enableEmailService bool = false

@description('Email service data location')
@allowed(['United States', 'Europe', 'UK', 'Japan', 'Australia', 'Asia Pacific'])
param emailDataLocation string = 'United States'

@description('Deployment timestamp for build tracking')
param deploymentTime string = utcNow('yyyy-MM-dd')

@description('GitHub repository URL for Static Web App')
param repositoryUrl string = ''

@description('GitHub repository branch')
param repositoryBranch string = 'main'

@description('Deployment ID for globally unique naming (e.g., user identifier from GitHub Actions)')
param deploymentId string = ''

// ============================================================================
// Variables
// ============================================================================

// Environment suffix for naming (pr-123, qa, prod)
var envSuffix = environment == 'pr' ? 'pr-${prNumber}' : environment

// Generate unique suffix from deployment ID to ensure consistent naming across runs
// For PR environments: uniqueSuffix is based on PR number only (consistent across runs)
// For staging/prod: uniqueSuffix is based on environment (stable across all deployments)
var uniqueSuffix = uniqueString(deploymentId)

// Resource names with global uniqueness guarantee
// Max 24 chars for Cosmos DB, so we use shortened names
var cosmosAccountName = 'ss${uniqueSuffix}'
var staticWebAppName = '${projectName}-${envSuffix}-${uniqueSuffix}'
var communicationServiceName = 'ss-acs-${uniqueSuffix}'
var emailServiceName = 'ss-email-${uniqueSuffix}'
var logAnalyticsName = 'ss-logs-${uniqueSuffix}'
var appInsightsName = 'ss-insights-${uniqueSuffix}'
var databaseName = 'secretsanta'
var containerName = 'games'

// Retention based on environment
// ⚠️  IMPORTANT: PerGB2018 SKU only allows specific retention values: 30, 31, 60, 90, 120, 180, 270, 365, 550, 730
// PR uses 30 days (minimum allowed, also cost-effective for ephemeral environments)
var retentionDays = environment == 'prod' ? 90 : 30
// ⚠️  NOTE: Free SKU for Log Analytics is no longer supported by Azure (deprecated as of July 1, 2022)
// All environments now use PerGB2018 which is the current standard pricing model
var logAnalyticsSku = 'PerGB2018'
// QA uses Cosmos DB free tier (Azure allows one per subscription) - sufficient for testing
// Production uses serverless pricing (pay per request) - unlimited scaling for real traffic
// PR environments also use serverless (ephemeral, minimal cost)
var enableFreeTier = environment == 'qa'

// ============================================================================
// Log Analytics Workspace (required for Application Insights)
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: logAnalyticsSku
    }
    retentionInDays: retentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ============================================================================
// Application Insights
// ============================================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: retentionDays
  }
}

// ============================================================================
// Cosmos DB - Serverless
// ============================================================================
// PRICING MODEL:
// - QA (enableFreeTier=true): $0/month (free tier, one per subscription)
// - PR/Production (enableFreeTier=false): Pay-per-request pricing
//   - Typical cost: <$5/month for light development workloads
//   - PR environments are deleted when PR closes (automatic cleanup)
//
// Serverless mode: No pre-provisioned throughput, automatic scaling
// ============================================================================

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: enableFreeTier
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      { name: 'EnableServerless' }
    ]
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: { id: databaseName }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [{ path: '/_etag/?' }]
      }
    }
  }
}

// ============================================================================
// Static Web App with Managed Functions
// ============================================================================
// Note: Staging environments are ENABLED to allow GitHub Actions deployments.
// When deploying from GitHub Actions without a linked repository, the action
// needs staging environment support to deploy content properly.

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {
    repositoryUrl: !empty(repositoryUrl) ? repositoryUrl : null
    branch: !empty(repositoryUrl) ? repositoryBranch : null
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
  }
}

// ============================================================================
// Azure Communication Services (Optional)
// ============================================================================
// Resources must be created in order: emailService → emailDomain → communicationService
// The communicationService needs linkedDomains to connect to the email domain

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = if (enableEmailService) {
  name: emailServiceName
  location: 'global'
  properties: {
    dataLocation: emailDataLocation
  }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (enableEmailService) {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = if (enableEmailService) {
  name: communicationServiceName
  location: 'global'
  properties: {
    dataLocation: emailDataLocation
    linkedDomains: [
      emailDomain.id
    ]
  }
}

// ============================================================================
// App Settings Configuration
// ============================================================================

resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2024-11-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: union(
    {
      // Database configuration
      COSMOS_ENDPOINT: cosmosAccount.properties.documentEndpoint
      COSMOS_KEY: cosmosAccount.listKeys().primaryMasterKey
      COSMOS_DATABASE_NAME: databaseName
      COSMOS_CONTAINER_NAME: containerName
      // Application Insights
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
      APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.properties.InstrumentationKey
      // Environment info
      ENVIRONMENT: environment
      // Build info
      BUILD_VERSION: '${envSuffix}-${uniqueSuffix}'
      BUILD_DATE: deploymentTime
      // App URL (for email links)
      // Uses the actual deployed Static Web App hostname (Azure assigns a random name)
      // For PR: Each PR gets its own SWA with a random Azure-assigned hostname
      // For staging/prod: Uses the shared resource's actual hostname
      APP_BASE_URL: 'https://${staticWebApp.properties.defaultHostname}'
    },
    enableEmailService ? {
      ACS_CONNECTION_STRING: communicationService!.listKeys().primaryConnectionString
      ACS_SENDER_ADDRESS: 'DoNotReply@${emailDomain!.properties.mailFromSenderDomain}'
    } : {}
  )
}

// ============================================================================
// Outputs
// ============================================================================

output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
output staticWebAppId string = staticWebApp.id
output cosmosAccountName string = cosmosAccount.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output appInsightsName string = appInsights.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output environment string = environment
output resourceGroupName string = resourceGroup().name

#disable-next-line outputs-should-not-contain-secrets
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
