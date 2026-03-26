import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

/**
 * Lightweight config endpoint for frontend initialization.
 * Returns only non-secret configuration values needed by the browser client.
 */
export async function configHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    },
    jsonBody: {
      appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || null
    }
  }
}

app.http('config', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'config',
  handler: configHandler
})
