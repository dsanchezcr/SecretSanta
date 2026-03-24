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

// Load JSON-LD structured data from static file (CSP-safe: no inline scripts)
const ldLink = document.createElement('script')
ldLink.type = 'application/ld+json'
ldLink.src = '/structured-data.json'
document.head.appendChild(ldLink)

createRoot(document.getElementById('app')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
