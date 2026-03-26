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

describe('rate-limiter - cleanup interval', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should clean up stale entries after the interval', () => {
    const { checkRateLimit: rl, RATE_LIMITS: limits } = jest.requireActual('../shared/rate-limiter') as typeof import('../shared/rate-limiter')
    const category = 'test-cleanup-' + Date.now()
    limits[category] = { windowMs: 1000, maxRequests: 1 }

    const createMockReq = (ip: string) => ({
      headers: new Map([['x-forwarded-for', ip]]),
      method: 'POST',
      url: 'http://localhost/api/games',
      query: new URLSearchParams(),
      params: {},
    }) as unknown as import('@azure/functions').HttpRequest

    const request = createMockReq('10.0.0.99')
    rl(request, category) // consume the 1 allowed request
    const blocked = rl(request, category)
    expect(blocked).not.toBeNull() // blocked

    // Advance time past the cleanup interval (5 minutes)
    jest.advanceTimersByTime(5 * 60 * 1000 + 100)

    // After cleanup, the same request should be allowed again (no longer rate-limited)
    const afterCleanup = rl(request, category)
    expect(afterCleanup).toBeNull()

    delete limits[category]
  })
})
