import { checkRateLimit, RATE_LIMITS } from '../shared/rate-limiter'
import { HttpRequest } from '@azure/functions'

describe('rate-limiter', () => {
  const createMockRequest = (ip: string = '127.0.0.1'): HttpRequest => ({
    headers: new Map([['x-forwarded-for', ip]]),
    method: 'POST',
    url: 'http://localhost/api/games',
    query: new URLSearchParams(),
    params: {},
  } as unknown as HttpRequest)

  it('should allow requests under the limit', () => {
    const request = createMockRequest('10.0.0.1')
    const result = checkRateLimit(request, 'default')
    expect(result).toBeNull()
  })

  it('should block requests over the limit', () => {
    const category = 'test-block-' + Date.now()
    // Override limits for this test
    RATE_LIMITS[category] = { windowMs: 60000, maxRequests: 2 }

    const request = createMockRequest('10.0.0.2')
    expect(checkRateLimit(request, category)).toBeNull() // 1st
    expect(checkRateLimit(request, category)).toBeNull() // 2nd
    const result = checkRateLimit(request, category)    // 3rd - should be blocked
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)

    delete RATE_LIMITS[category]
  })

  it('should return 429 with Retry-After header', () => {
    const category = 'test-retry-' + Date.now()
    RATE_LIMITS[category] = { windowMs: 60000, maxRequests: 1 }

    const request = createMockRequest('10.0.0.3')
    checkRateLimit(request, category) // 1st allowed
    const result = checkRateLimit(request, category) // 2nd blocked
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    expect((result!.headers as Record<string, string>)?.['Retry-After']).toBeDefined()

    delete RATE_LIMITS[category]
  })
})
