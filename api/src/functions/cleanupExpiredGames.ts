import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { timingSafeEqual } from 'crypto'
import { getDatabaseStatus, getContainer } from '../shared/cosmosdb'
import { trackError, trackEvent } from '../shared/telemetry'
import { Game } from '../shared/types'

/**
 * Core cleanup logic: deletes games whose event date is 3+ days in the past.
 * Exported separately so it can be unit-tested without HTTP context.
 */
export async function performCleanup(context: InvocationContext): Promise<{ deletedCount: number; failedCount: number; totalFound: number } | null> {
  const requestId = context.invocationId

  // Check database connectivity first
  const dbStatus = getDatabaseStatus()
  if (!dbStatus.connected) {
    context.error('❌ Database not connected, skipping cleanup')
    trackError(context, new Error('Database not available for cleanup'), { requestId })
    return null
  }

  const container = await getContainer()

  // Calculate the cutoff date (3 days ago)
  const now = new Date()
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() - 3)
  cutoffDate.setHours(23, 59, 59, 999) // End of that day
  const cutoffDateString = cutoffDate.toISOString().split('T')[0]

  context.log(`📅 Looking for games with event date on or before ${cutoffDateString}`)

  // Query for games whose event date is 3+ days in the past
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.date <= @cutoffDate',
    parameters: [{ name: '@cutoffDate', value: cutoffDateString }]
  }

  const { resources: expiredGames } = await container.items.query<Game>(querySpec).fetchAll()

  if (expiredGames.length === 0) {
    context.log('✅ No expired games found')
    trackEvent(context, 'CleanupExpiredGames', {
      requestId,
      deletedCount: '0',
      message: 'No expired games found'
    })
    return { deletedCount: 0, failedCount: 0, totalFound: 0 }
  }

  context.log(`🗑️ Found ${expiredGames.length} expired game(s) to delete`)

  let deletedCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const game of expiredGames) {
    try {
      await container.item(game.id, game.id).delete()
      deletedCount++
      context.log(`✅ Deleted game: ${game.code} (event date: ${game.date})`)
    } catch (error: any) {
      failedCount++
      const errorMessage = `Failed to delete game ${game.code}: ${error.message}`
      errors.push(errorMessage)
      context.error(errorMessage)
    }
  }

  trackEvent(context, 'CleanupExpiredGames', {
    requestId,
    deletedCount: String(deletedCount),
    failedCount: String(failedCount),
    totalFound: String(expiredGames.length)
  })

  context.log(`🧹 Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`)

  if (errors.length > 0) {
    trackError(context, new Error(`Partial cleanup failure: ${errors.join('; ')}`), {
      requestId,
      deletedCount: String(deletedCount),
      failedCount: String(failedCount)
    })
  }

  return { deletedCount, failedCount, totalFound: expiredGames.length }
}

/**
 * HTTP trigger that replaces the unsupported timer trigger for Azure Static Web Apps
 * Managed Functions (which only support HTTP triggers).
 *
 * Called by a GitHub Actions cron workflow (daily at 2:00 AM UTC).
 * Requires the x-cleanup-secret request header to match the CLEANUP_SECRET
 * environment variable. Header lookup via the Fetch API Headers interface is
 * case-insensitive, so 'X-Cleanup-Secret' and 'x-cleanup-secret' are equivalent.
 */
export async function cleanupExpiredGamesHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = context.invocationId
  context.log(`🧹 Cleanup expired games triggered via HTTP [requestId: ${requestId}]`)

  // Validate secret token to prevent unauthorized invocations
  const cleanupSecret = process.env.CLEANUP_SECRET
  if (!cleanupSecret) {
    context.error('❌ CLEANUP_SECRET environment variable is not configured')
    return { status: 500, jsonBody: { error: 'Server configuration error' } }
  }

  // Use timing-safe comparison to prevent timing attacks on the shared secret
  // Headers.get() is case-insensitive per the Fetch API specification
  const providedSecret = request.headers.get('x-cleanup-secret')
  let secretsMatch = false
  if (providedSecret) {
    try {
      const a = Buffer.from(providedSecret)
      const b = Buffer.from(cleanupSecret)
      secretsMatch = a.length === b.length && timingSafeEqual(a, b)
    } catch {
      secretsMatch = false
    }
  }
  if (!secretsMatch) {
    context.warn('⚠️ Unauthorized cleanup attempt - invalid or missing secret')
    return { status: 401, jsonBody: { error: 'Unauthorized' } }
  }

  try {
    const result = await performCleanup(context)

    if (result === null) {
      return { status: 503, jsonBody: { error: 'Database not available' } }
    }

    return { status: 200, jsonBody: result }
  } catch (error: any) {
    context.error('❌ Error during cleanup:', error)
    trackError(context, error, { requestId })
    return { status: 500, jsonBody: { error: 'Internal server error' } }
  }
}

app.http('cleanupExpiredGames', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'games/cleanup',
  handler: cleanupExpiredGamesHandler
})
