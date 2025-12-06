/**
 * Google Analytics integration with consent management
 */

// Google Analytics tracking ID from environment variable
// Set VITE_GA_TRACKING_ID to your own property to enable analytics
// If unset or empty, analytics are completely disabled
const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID || ''

// Check if we're in production environment
const isProduction = import.meta.env.PROD

// LocalStorage key for consent
const CONSENT_KEY = 'secretsanta:analytics-consent'

// LocalStorage key for declined consent
const DECLINED_KEY = 'secretsanta:analytics-declined'

/**
 * Check if user has given consent for analytics
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const consent = window.localStorage.getItem(CONSENT_KEY)
    return consent === 'true'
  } catch {
    return false
  }
}

/**
 * Set user's analytics consent preference
 */
export function setAnalyticsConsent(consent: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, consent.toString())
    // Clear declined flag if accepting
    if (consent) {
      window.localStorage.removeItem(DECLINED_KEY)
      initializeAnalytics()
    }
  } catch (error) {
    console.warn('Error saving analytics consent:', error)
  }
}

/**
 * Check if user has declined analytics
 */
export function hasDeclinedAnalytics(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DECLINED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Set that user has declined analytics
 */
export function setAnalyticsDeclined(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DECLINED_KEY, 'true')
    window.localStorage.removeItem(CONSENT_KEY)
  } catch (error) {
    console.warn('Error saving analytics declined:', error)
  }
}

/**
 * Initialize Google Analytics if consent is given and in production
 */
export function initializeAnalytics(): void {
  // Only load in production environment
  if (!isProduction) {
    return
  }

  // Check if tracking ID is configured
  if (!GA_TRACKING_ID || GA_TRACKING_ID.trim() === '') {
    return
  }

  // Check for user consent
  if (!hasAnalyticsConsent()) {
    return
  }

  // Check if already initialized
  if (window.gtag) {
    return
  }

  // Load gtag.js script
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`
  document.head.appendChild(script)

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_TRACKING_ID)
}

/**
 * Track a page view (only if analytics is initialized)
 */
export function trackPageView(page: string): void {
  if (window.gtag && isProduction && hasAnalyticsConsent()) {
    window.gtag('event', 'page_view', {
      page_path: page,
    })
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}
