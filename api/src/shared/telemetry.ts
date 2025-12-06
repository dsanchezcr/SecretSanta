import { InvocationContext } from '@azure/functions'

// Application Insights configuration
let appInsightsConnectionString: string | undefined
let appInsightsInitialized = false

interface TelemetryConfig {
  connectionString: string | undefined
  configured: boolean
}

export function getTelemetryConfig(): TelemetryConfig {
  return {
    connectionString: appInsightsConnectionString,
    configured: appInsightsInitialized
  }
}

export function initializeTelemetry(): void {
  appInsightsConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  appInsightsInitialized = !!appInsightsConnectionString
}

// Standardized error types for consistent API responses
export enum ApiErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMAIL_ERROR = 'EMAIL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: string
  timestamp: string
  requestId?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

// Create standardized error response
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: string,
  requestId?: string
): ApiError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId
  }
}

// Map error codes to HTTP status codes
export function getHttpStatusForError(code: ApiErrorCode): number {
  switch (code) {
    case ApiErrorCode.BAD_REQUEST:
    case ApiErrorCode.VALIDATION_ERROR:
      return 400
    case ApiErrorCode.UNAUTHORIZED:
      return 401
    case ApiErrorCode.FORBIDDEN:
      return 403
    case ApiErrorCode.NOT_FOUND:
      return 404
    case ApiErrorCode.CONFLICT:
      return 409
    case ApiErrorCode.DATABASE_ERROR:
    case ApiErrorCode.EMAIL_ERROR:
    case ApiErrorCode.SERVICE_UNAVAILABLE:
      return 503
    case ApiErrorCode.INTERNAL_ERROR:
    default:
      return 500
  }
}

// Log and track errors with optional Application Insights
export function trackError(
  context: InvocationContext,
  error: Error | unknown,
  properties?: Record<string, string>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  
  // Always log to context (Azure Functions built-in logging)
  context.error('Error:', errorMessage)
  if (errorStack) {
    context.error('Stack:', errorStack)
  }
  
  // If Application Insights is configured, it will automatically capture
  // errors through the Azure Functions integration
  if (appInsightsInitialized && properties) {
    context.error('Error properties:', JSON.stringify(properties))
  }
}

// Track custom events/metrics
export function trackEvent(
  context: InvocationContext,
  eventName: string,
  properties?: Record<string, string>,
  metrics?: Record<string, number>
): void {
  const logMessage = `Event: ${eventName}`
  context.log(logMessage)
  
  if (properties) {
    context.log('Properties:', JSON.stringify(properties))
  }
  if (metrics) {
    context.log('Metrics:', JSON.stringify(metrics))
  }
}

// Track dependency calls (e.g., Cosmos DB, Email Service)
export function trackDependency(
  context: InvocationContext,
  dependencyName: string,
  success: boolean,
  durationMs: number,
  properties?: Record<string, string>
): void {
  if (appInsightsInitialized) {
    context.log(`Dependency: ${dependencyName} (${durationMs}ms, success: ${success})`)
    if (properties) {
      context.log('Properties:', JSON.stringify(properties))
    }
  }
}

// Initialize telemetry on module load
initializeTelemetry()
