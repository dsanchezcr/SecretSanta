import { HttpRequest, InvocationContext } from '@azure/functions'
import { healthHandler, livenessHandler, readinessHandler } from '../functions/health'

// Mock the cosmosdb module
jest.mock('../shared/cosmosdb', () => ({
  getDatabaseStatus: jest.fn(),
  getGameByCode: jest.fn().mockResolvedValue(null) // Health check query returns null
}))

// Mock the email-service module
jest.mock('../shared/email-service', () => ({
  getEmailServiceStatus: jest.fn()
}))

// Mock the telemetry module
jest.mock('../shared/telemetry', () => ({
  getTelemetryConfig: jest.fn().mockReturnValue({ configured: false }),
  trackEvent: jest.fn(),
  trackError: jest.fn()
}))

import { getDatabaseStatus } from '../shared/cosmosdb'
import { getEmailServiceStatus } from '../shared/email-service'

const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock
const mockGetEmailServiceStatus = getEmailServiceStatus as jest.Mock

describe('health function', () => {
  let mockRequest: HttpRequest
  let mockContext: InvocationContext

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/health',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {},
    } as unknown as HttpRequest
    
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext

    // Default email service mock
    mockGetEmailServiceStatus.mockReturnValue({
      configured: false,
      error: 'ACS_CONNECTION_STRING environment variable is not configured'
    })
  })

  it('should return 200 healthy when database is connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.status).toBe('healthy')
    expect(body.checks.database.status).toBe('ok')
    expect(body.checks.email.status).toBe('not_configured')
    expect(body.timestamp).toBeDefined()
    expect(body.version).toBeDefined()
    expect(body.uptime).toBeDefined()
  })

  it('should return 503 unhealthy when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: false,
      error: 'Connection failed'
    })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(503)
    const body = response.jsonBody as any
    expect(body.status).toBe('unhealthy')
    expect(body.checks.database.status).toBe('error')
    expect(body.checks.database.error).toBe('Connection failed')
  })

  it('should include timestamp in ISO format', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    const response = await healthHandler(mockRequest, mockContext)
    const body = response.jsonBody as any

    // Validate ISO 8601 format
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('should log health check request', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    await healthHandler(mockRequest, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith('Health check requested')
  })
})

describe('healthHandler - additional branches', () => {
  let mockRequest: HttpRequest
  let mockContext: InvocationContext
  const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock
  const mockGetEmailServiceStatus = getEmailServiceStatus as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/health',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {},
    } as unknown as HttpRequest

    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext
  })

  it('should return degraded status when email has error', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: true, error: 'ACS service error' })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.status).toBe('degraded')
    expect(body.checks.email.status).toBe('error')
  })

  it('should return ok email status when email service is configured', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: true, error: null })

    const response = await healthHandler(mockRequest, mockContext)

    const body = response.jsonBody as any
    expect(body.checks.email.status).toBe('ok')
  })

  it('should include system info when verbose=true in non-prod environment', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: false, error: null })

    const verboseRequest = {
      method: 'GET',
      url: 'http://localhost/api/health?verbose=true',
      headers: new Headers(),
      query: new URLSearchParams('verbose=true'),
      params: {},
    } as unknown as HttpRequest

    const originalEnv = process.env.ENVIRONMENT
    process.env.ENVIRONMENT = 'development'

    const response = await healthHandler(verboseRequest, mockContext)

    process.env.ENVIRONMENT = originalEnv

    const body = response.jsonBody as any
    expect(body.system).toBeDefined()
    expect(body.system.nodeVersion).toBeDefined()
  })
})

describe('livenessHandler', () => {
  let mockRequest: HttpRequest
  let mockContext: InvocationContext

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/health/live',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {},
    } as unknown as HttpRequest

    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext
  })

  it('should return 200 alive', async () => {
    const response = await livenessHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.status).toBe('alive')
    expect(body.timestamp).toBeDefined()
  })
})

describe('readinessHandler', () => {
  let mockRequest: HttpRequest
  let mockContext: InvocationContext

  beforeEach(() => {
    jest.clearAllMocks()

    mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/health/ready',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {},
    } as unknown as HttpRequest

    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext
  })

  it('should return 200 ready when database is connected', async () => {
    const mockGetDatabaseStatus = jest.requireMock('../shared/cosmosdb').getDatabaseStatus as jest.Mock
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })

    const response = await readinessHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.status).toBe('ready')
    expect(body.timestamp).toBeDefined()
  })

  it('should return 503 not_ready when database is not connected', async () => {
    const mockGetDatabaseStatus = jest.requireMock('../shared/cosmosdb').getDatabaseStatus as jest.Mock
    mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Connection failed' })

    const response = await readinessHandler(mockRequest, mockContext)

    expect(response.status).toBe(503)
    const body = response.jsonBody as any
    expect(body.status).toBe('not_ready')
    expect(body.reason).toBeDefined()
    expect(body.timestamp).toBeDefined()
  })
})
