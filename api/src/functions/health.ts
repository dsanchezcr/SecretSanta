import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getDatabaseStatus, getGameByCode } from '../shared/cosmosdb'
import { getEmailServiceStatus } from '../shared/email-service'
import { getTelemetryConfig, trackEvent } from '../shared/telemetry'

// Build version for deployment tracking
const BUILD_VERSION = process.env.BUILD_VERSION || 'local'
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  buildDate: string
  environment: string
  uptime: number
  timestamp: string
  checks: {
    database: DependencyCheck
    email: DependencyCheck
    telemetry: DependencyCheck
  }
  system?: SystemInfo
}

interface DependencyCheck {
  status: 'ok' | 'degraded' | 'error' | 'not_configured'
  latencyMs?: number
  error?: string
  details?: Record<string, unknown>
}

interface SystemInfo {
  nodeVersion: string
  platform: string
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
}

// Track when the API started
const startTime = Date.now()

async function checkDatabaseHealth(): Promise<DependencyCheck> {
  const start = Date.now()
  const dbStatus = getDatabaseStatus()
  
  if (!dbStatus.connected) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: dbStatus.error || 'Database not connected'
    }
  }
  
  try {
    // Perform a lightweight query to verify actual connectivity
    // Use a non-existent code to minimize data transfer
    await getGameByCode('__health_check__')
    
    return {
      status: 'ok',
      latencyMs: Date.now() - start,
      details: {
        database: process.env.COSMOS_DATABASE_NAME || 'secretsanta',
        container: process.env.COSMOS_CONTAINER_NAME || 'games'
      }
    }
  } catch (error: any) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: error.message || 'Database query failed'
    }
  }
}

function checkEmailHealth(): DependencyCheck {
  const emailStatus = getEmailServiceStatus()
  
  if (!emailStatus.configured) {
    return {
      status: 'not_configured',
      details: {
        message: 'Email service is optional - set ACS_CONNECTION_STRING to enable'
      }
    }
  }
  
  if (emailStatus.error) {
    return {
      status: 'error',
      error: emailStatus.error
    }
  }
  
  return {
    status: 'ok',
    details: {
      provider: 'Azure Communication Services'
    }
  }
}

function checkTelemetryHealth(): DependencyCheck {
  const telemetryConfig = getTelemetryConfig()
  
  if (!telemetryConfig.configured) {
    return {
      status: 'not_configured',
      details: {
        message: 'Application Insights is optional - set APPLICATIONINSIGHTS_CONNECTION_STRING to enable'
      }
    }
  }
  
  return {
    status: 'ok',
    details: {
      provider: 'Azure Application Insights'
    }
  }
}

function getSystemInfo(): SystemInfo {
  const memUsage = process.memoryUsage()
  
  return {
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024) // MB
    }
  }
}

function determineOverallStatus(checks: HealthCheckResult['checks']): 'healthy' | 'degraded' | 'unhealthy' {
  // Database is required - if it's down, we're unhealthy
  if (checks.database.status === 'error') {
    return 'unhealthy'
  }
  
  // If database is ok but optional services have issues, we're degraded
  const hasOptionalIssues = 
    checks.email.status === 'error' || 
    checks.telemetry.status === 'error'
  
  if (hasOptionalIssues) {
    return 'degraded'
  }
  
  return 'healthy'
}

export async function healthHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Health check requested')
  
  // Check if verbose mode is requested (for debugging)
  const verbose = request.query.get('verbose') === 'true'
  
  // Perform health checks
  const databaseCheck = await checkDatabaseHealth()
  const emailCheck = checkEmailHealth()
  const telemetryCheck = checkTelemetryHealth()
  
  const checks = {
    database: databaseCheck,
    email: emailCheck,
    telemetry: telemetryCheck
  }
  
  const overallStatus = determineOverallStatus(checks)
  
  const result: HealthCheckResult = {
    status: overallStatus,
    version: BUILD_VERSION,
    buildDate: BUILD_DATE,
    environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'Development',
    uptime: Math.round((Date.now() - startTime) / 1000), // seconds
    timestamp: new Date().toISOString(),
    checks
  }
  
  // Include system info in verbose mode
  if (verbose) {
    result.system = getSystemInfo()
  }
  
  // Track health check event
  trackEvent(context, 'HealthCheck', {
    status: overallStatus,
    databaseStatus: databaseCheck.status,
    emailStatus: emailCheck.status
  })
  
  // Return appropriate HTTP status
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200
  
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
