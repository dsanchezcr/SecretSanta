import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Register service worker for PWA support (production only to avoid HMR caching issues)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Fetch JSON-LD structured data and inject inline (crawlers don't follow script src for JSON-LD)
fetch('/structured-data.json')
  .then(r => r.text())
  .then(text => {
    const ldScript = document.createElement('script')
    ldScript.type = 'application/ld+json'
    ldScript.text = text
    document.head.appendChild(ldScript)
  })
  .catch(() => {})

createRoot(document.getElementById('app')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
