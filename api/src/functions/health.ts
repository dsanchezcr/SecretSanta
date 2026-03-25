import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getDatabaseStatus, getGameByCode } from '../shared/cosmosdb'
import { getEmailServiceStatus } from '../shared/email-service'
import { getTelemetryConfig, trackEvent } from '../shared/telemetry'

// Build version for deployment tracking
const BUILD_VERSION = process.env.BUILD_VERSION || 'local'
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]

interface ServiceCheck {
  name: string
  status: 'Healthy' | 'Degraded' | 'Unhealthy'
  message: string
  responseTimeMs: number | null
}

// Track when the API started
const startTime = Date.now()

async function checkDatabaseService(): Promise<ServiceCheck> {
  const start = Date.now()
  const dbStatus = getDatabaseStatus()
  
  if (!dbStatus.connected) {
    return {
      name: 'Azure Cosmos DB',
      status: 'Unhealthy',
      message: dbStatus.error || 'Database not connected',
      responseTimeMs: Date.now() - start
    }
  }
  
  try {
    await getGameByCode('__health_check__')
    return {
      name: 'Azure Cosmos DB',
      status: 'Healthy',
      message: 'Database operational',
      responseTimeMs: Date.now() - start
    }
  } catch {
    return {
      name: 'Azure Cosmos DB',
      status: 'Unhealthy',
      message: 'Database query failed',
      responseTimeMs: Date.now() - start
    }
  }
}

function checkEmailService(): ServiceCheck {
  const emailStatus = getEmailServiceStatus()
  
  if (!emailStatus.configured) {
    return {
      name: 'Azure Communication Services (Email)',
      status: 'Degraded',
      message: 'Not configured',
      responseTimeMs: null
    }
  }
  
  if (emailStatus.error) {
    return {
      name: 'Azure Communication Services (Email)',
      status: 'Unhealthy',
      message: 'Service error',
      responseTimeMs: null
    }
  }
  
  return {
    name: 'Azure Communication Services (Email)',
    status: 'Healthy',
    message: 'Configuration valid',
    responseTimeMs: null
  }
}

function checkTelemetryService(): ServiceCheck {
  const telemetryConfig = getTelemetryConfig()
  
  if (!telemetryConfig.configured) {
    return {
      name: 'Azure Application Insights',
      status: 'Degraded',
      message: 'Not configured',
      responseTimeMs: null
    }
  }
  
  return {
    name: 'Azure Application Insights',
    status: 'Healthy',
    message: 'Configuration valid',
    responseTimeMs: null
  }
}

function determineOverallStatus(services: ServiceCheck[]): 'Healthy' | 'Degraded' | 'Unhealthy' {
  if (services.some(s => s.name === 'Azure Cosmos DB' && s.status === 'Unhealthy')) {
    return 'Unhealthy'
  }
  if (services.some(s => s.status === 'Unhealthy' || s.status === 'Degraded')) {
    return 'Degraded'
  }
  return 'Healthy'
}

export async function healthHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Health check requested')
  
  const databaseService = await checkDatabaseService()
  const emailService = checkEmailService()
  const telemetryService = checkTelemetryService()
  
  const services = [databaseService, emailService, telemetryService]
  const overallStatus = determineOverallStatus(services)
  
  // Track health check event
  trackEvent(context, 'HealthCheck', {
    status: overallStatus,
    databaseStatus: databaseService.status,
    emailStatus: emailService.status
  })
  
  const httpStatus = overallStatus === 'Unhealthy' ? 503 : 200

  const result: Record<string, unknown> = {
    overallStatus,
    timestamp: new Date().toISOString(),
    version: BUILD_VERSION,
    buildDate: BUILD_DATE,
    environment: process.env.ENVIRONMENT || 'Development',
    uptime: Math.round((Date.now() - startTime) / 1000),
    services,
    environmentVariables: {
      COSMOS_ENDPOINT: !!process.env.COSMOS_ENDPOINT,
      COSMOS_KEY: !!process.env.COSMOS_KEY,
      COSMOS_DATABASE_NAME: !!process.env.COSMOS_DATABASE_NAME,
      COSMOS_CONTAINER_NAME: !!process.env.COSMOS_CONTAINER_NAME,
      APPLICATIONINSIGHTS_CONNECTION_STRING: !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      ACS_CONNECTION_STRING: !!process.env.ACS_CONNECTION_STRING,
      APP_BASE_URL: !!process.env.APP_BASE_URL,
      CLEANUP_SECRET: !!process.env.CLEANUP_SECRET
    }
  }

  return {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    jsonBody: result
  }
}

// Simple liveness probe (for container orchestration)
export async function livenessHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: { status: 'alive', timestamp: new Date().toISOString() }
  }
}

// Readiness probe (checks if ready to serve traffic)
export async function readinessHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const dbStatus = getDatabaseStatus()
  
  if (!dbStatus.connected) {
    return {
      status: 503,
      jsonBody: { 
        status: 'not_ready', 
        reason: 'Database not connected',
        timestamp: new Date().toISOString() 
      }
    }
  }
  
  return {
    status: 200,
    jsonBody: { status: 'ready', timestamp: new Date().toISOString() }
  }
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler
})

app.http('liveness', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health/live',
  handler: livenessHandler
})

app.http('readiness', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health/ready',
  handler: readinessHandler
})
