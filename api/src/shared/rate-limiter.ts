import { HttpRequest, HttpResponseInit } from '@azure/functions'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000).unref()

export interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
}

// Default limits per route category
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  createGame: { windowMs: 60_000, maxRequests: 10 },  // 10 games/min
  sendEmail: { windowMs: 60_000, maxRequests: 20 },   // 20 emails/min
  default: { windowMs: 60_000, maxRequests: 60 },     // 60 req/min general
}

function getClientIp(request: HttpRequest): string {
  // Azure Static Web Apps / Functions forwarded headers
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-client-ip')
    || request.headers.get('x-real-ip')
    || 'unknown'
}

/**
 * Check rate limit for a request. Returns null if allowed, or an HTTP response if rate limited.
 */
export function checkRateLimit(request: HttpRequest, category: string): HttpResponseInit | null {
  const config = RATE_LIMITS[category] || RATE_LIMITS.default
  const clientIp = getClientIp(request)
  const key = `${category}:${clientIp}`
  const now = Date.now()

  let entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs }
    store.set(key, entry)
  }

  entry.count++

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      },
      jsonBody: { error: 'Too many requests. Please try again later.' }
    }
  }

  return null
}
