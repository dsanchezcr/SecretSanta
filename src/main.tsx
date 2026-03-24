import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Inject JSON-LD structured data via JS (CSP-safe: avoids inline <script> in HTML)
const ldJson = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Secret Santa',
  description: 'Organize your Secret Santa gift exchange easily. Create games, assign participants, set budgets, and send invitations.',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
}
const ldScript = document.createElement('script')
ldScript.type = 'application/ld+json'
ldScript.text = JSON.stringify(ldJson)
document.head.appendChild(ldScript)

createRoot(document.getElementById('app')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
