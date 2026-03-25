import { HttpRequest, InvocationContext } from '@azure/functions'
import { configHandler } from '../functions/config'

describe('config function', () => {
  let mockRequest: HttpRequest
  let mockContext: InvocationContext

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/config',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {},
    } as unknown as HttpRequest

    mockContext = {
      log: jest.fn(),
    } as unknown as InvocationContext
  })

  it('should return App Insights connection string when configured', async () => {
    const originalValue = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=test-key'

    const response = await configHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({
      appInsightsConnectionString: 'InstrumentationKey=test-key'
    })
    const headers = response.headers as Record<string, string>
    expect(headers['Cache-Control']).toContain('max-age=3600')

    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalValue
  })

  it('should return null when App Insights is not configured', async () => {
    const originalValue = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING

    const response = await configHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({
      appInsightsConnectionString: null
    })

    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalValue
  })

  it('should not expose any other environment variables', async () => {
    const response = await configHandler(mockRequest, mockContext)
    const body = response.jsonBody as Record<string, unknown>

    const allowedKeys = ['appInsightsConnectionString']
    const returnedKeys = Object.keys(body)
    expect(returnedKeys.every(k => allowedKeys.includes(k))).toBe(true)
  })
})
