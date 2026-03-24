import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { initializeAppInsights, trackAppInsightsException } from './lib/app-insights.ts'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Initialize Application Insights for frontend telemetry
initializeAppInsights()

// Register service worker for PWA support (production only to avoid HMR caching issues)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Global unhandled error tracking
window.addEventListener('error', (event) => {
  if (event.error) {
    trackAppInsightsException(event.error, { source: 'window.onerror' })
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  trackAppInsightsException(error, { source: 'unhandledrejection' })
})

createRoot(document.getElementById('app')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
