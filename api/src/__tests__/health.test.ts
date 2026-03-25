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
import { getTelemetryConfig } from '../shared/telemetry'

const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock
const mockGetEmailServiceStatus = getEmailServiceStatus as jest.Mock
const mockGetTelemetryConfig = getTelemetryConfig as jest.Mock

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

  it('should return 200 Healthy when database is connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })
    mockGetEmailServiceStatus.mockReturnValue({ configured: true, error: null })
    mockGetTelemetryConfig.mockReturnValue({ configured: true })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.overallStatus).toBe('Healthy')
    expect(body.services).toBeInstanceOf(Array)
    expect(body.services.find((s: any) => s.name === 'Azure Cosmos DB').status).toBe('Healthy')
    expect(body.timestamp).toBeDefined()
    expect(body.version).toBeDefined()
    expect(body.uptime).toBeDefined()
    expect(body.environmentVariables).toBeDefined()
  })

  it('should return 200 Degraded when optional services are not configured', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.overallStatus).toBe('Degraded')
    expect(body.services.find((s: any) => s.name === 'Azure Cosmos DB').status).toBe('Healthy')
  })

  it('should return 503 Unhealthy when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: false,
      error: 'Connection failed'
    })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(503)
    const body = response.jsonBody as any
    expect(body.overallStatus).toBe('Unhealthy')
    expect(body.services.find((s: any) => s.name === 'Azure Cosmos DB').status).toBe('Unhealthy')
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

  it('should show environment variable presence as booleans without values', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: false, error: null })

    const response = await healthHandler(mockRequest, mockContext)
    const body = response.jsonBody as any

    expect(body.environmentVariables).toBeDefined()
    // All values should be booleans (true/false), never actual secret values
    for (const val of Object.values(body.environmentVariables)) {
      expect(typeof val).toBe('boolean')
    }
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

  it('should return Degraded status when email has error', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: true, error: 'ACS service error' })

    const response = await healthHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    const body = response.jsonBody as any
    expect(body.overallStatus).toBe('Degraded')
    expect(body.services.find((s: any) => s.name === 'Azure Communication Services (Email)').status).toBe('Unhealthy')
  })

  it('should return Healthy email status when email service is configured', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: true, error: null })

    const response = await healthHandler(mockRequest, mockContext)

    const body = response.jsonBody as any
    expect(body.services.find((s: any) => s.name === 'Azure Communication Services (Email)').status).toBe('Healthy')
  })

  it('should include services array with name, status, message, and responseTimeMs', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetEmailServiceStatus.mockReturnValue({ configured: false, error: null })

    const response = await healthHandler(mockRequest, mockContext)

    const body = response.jsonBody as any
    expect(body.services).toHaveLength(3)
    for (const service of body.services) {
      expect(service).toHaveProperty('name')
      expect(service).toHaveProperty('status')
      expect(service).toHaveProperty('message')
      expect(service).toHaveProperty('responseTimeMs')
    }
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
