import { HttpRequest, InvocationContext } from '@azure/functions'
import { healthHandler } from '../functions/health'

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
