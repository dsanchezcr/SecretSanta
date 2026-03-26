import { ApplicationInsights } from '@microsoft/applicationinsights-web'

let appInsights: ApplicationInsights | null = null
let initialized = false

// Query params that may carry sensitive tokens or game codes
const SENSITIVE_PARAMS = ['code', 'organizer', 'participant', 'invitation']

// Regex to redact 6-digit game codes embedded in API path segments (e.g. /api/games/123456)
const SENSITIVE_PATH_PATTERN = /(\/(games|archive)\/)\d{6}(?=\/|$|\?)/g

/**
 * Strip sensitive data from a URL string:
 * - Replaces values of sensitive query params with '[redacted]'
 * - Replaces 6-digit game codes in known path segments with '[redacted]'
 * Non-URL strings are returned unchanged.
 */
function sanitizeSensitiveUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const parsed = new URL(url, window.location.origin)
    let changed = false
    for (const param of SENSITIVE_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[redacted]')
        changed = true
      }
    }
    // Redact game codes in path (e.g. /api/games/123456)
    const sanitizedPathname = parsed.pathname.replace(SENSITIVE_PATH_PATTERN, '$1[redacted]')
    if (sanitizedPathname !== parsed.pathname) {
      parsed.pathname = sanitizedPathname
      changed = true
    }
    return changed ? parsed.toString() : url
  } catch {
    // Fallback: apply path redaction directly on the raw string for non-absolute URLs
    return url.replace(SENSITIVE_PATH_PATTERN, '$1[redacted]')
  }
}

/**
 * Initialize Application Insights for frontend telemetry.
 * Fetches the connection string from a dedicated config endpoint at runtime.
 * Sets initialized = true only after successful SDK load so retries succeed on transient failures.
 */
export async function initializeAppInsights(): Promise<void> {
  if (typeof window === 'undefined' || initialized) return

  try {
    const response = await fetch('/api/config')
    if (!response.ok) return
    const data = await response.json()
    const connectionString = data.appInsightsConnectionString
    if (!connectionString) return

    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: false,
        disableFetchTracking: false,
        enableCorsCorrelation: true,
        enableRequestHeaderTracking: false,
        enableResponseHeaderTracking: false,
        disableExceptionTracking: false,
        autoTrackPageVisitTime: true,
      }
    })

    // Telemetry initializer: redact sensitive query params from ALL telemetry items
    // (page views, exceptions, dependency tracking) before they are sent to Azure.
    appInsights.addTelemetryInitializer((envelope) => {
      const base = envelope.baseData as Record<string, unknown> | undefined
      if (base) {
        if (typeof base['uri'] === 'string') base['uri'] = sanitizeSensitiveUrl(base['uri'])
        if (typeof base['url'] === 'string') base['url'] = sanitizeSensitiveUrl(base['url'])
        // Dependency tracking stores the full URL in 'data' and a display name in 'name'
        if (typeof base['data'] === 'string') base['data'] = sanitizeSensitiveUrl(base['data'])
        if (typeof base['name'] === 'string') base['name'] = sanitizeSensitiveUrl(base['name'])
      }
    })

    appInsights.loadAppInsights()
    // Only mark as initialized after successful load so transient failures allow a retry
    initialized = true
  } catch {
    // Silently fail - telemetry is optional; leave initialized = false so next call retries
  }
}

/**
 * Track a page view with sanitized URL (strips sensitive query params).
 */
export function trackAppInsightsPageView(name: string, uri?: string): void {
  if (!appInsights) return
  try {
    const url = new URL(uri || window.location.href, window.location.origin)
    const sanitizedParams = new URLSearchParams()
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'lang' || key === 'view') {
        sanitizedParams.set(key, value)
      }
    }
    const sanitizedUri = `${url.pathname}${sanitizedParams.toString() ? '?' + sanitizedParams.toString() : ''}`
    appInsights.trackPageView({ name, uri: sanitizedUri })
  } catch {
    // Silently fail
  }
}

/**
 * Track a custom event.
 */
export function trackAppInsightsEvent(name: string, properties?: Record<string, string>): void {
  if (!appInsights) return
  appInsights.trackEvent({ name }, properties)
}

/**
 * Track an exception/error.
 */
export function trackAppInsightsException(error: Error, properties?: Record<string, string>): void {
  if (!appInsights) return
  appInsights.trackException({ exception: error }, properties)
}
