import { ApplicationInsights } from '@microsoft/applicationinsights-web'

let appInsights: ApplicationInsights | null = null
let initialized = false

/**
 * Initialize Application Insights for frontend telemetry.
 * Fetches the connection string from the API's health endpoint at runtime.
 */
export async function initializeAppInsights(): Promise<void> {
  if (typeof window === 'undefined' || initialized) return
  initialized = true

  try {
    const response = await fetch('/api/health')
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

    appInsights.loadAppInsights()
  } catch {
    // Silently fail - telemetry is optional
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
