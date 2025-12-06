import { app, InvocationContext, Timer } from '@azure/functions'
import { getDatabaseStatus, getContainer } from '../shared/cosmosdb'
import { trackError, trackEvent } from '../shared/telemetry'
import { Game } from '../shared/types'

/**
 * Timer trigger function that runs daily to delete expired games.
 * Games are deleted 3 days after their event date.
 * 
 * Schedule: Runs at 2:00 AM UTC every day
 */
export async function cleanupExpiredGames(myTimer: Timer, context: InvocationContext): Promise<void> {
  const requestId = context.invocationId
  context.log(`🧹 Cleanup expired games function triggered [requestId: ${requestId}]`)
  
  if (myTimer.isPastDue) {
    context.log('Timer is past due!')
  }
  
  // Check database connectivity first
  const dbStatus = getDatabaseStatus()
  if (!dbStatus.connected) {
    context.error('❌ Database not connected, skipping cleanup')
    trackError(context, new Error('Database not available for cleanup'), { requestId })
    return
  }
  
  try {
    const container = await getContainer()
    
    // Calculate the cutoff date (3 days ago)
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - 3)
    cutoffDate.setHours(23, 59, 59, 999) // End of that day
    const cutoffDateString = cutoffDate.toISOString().split('T')[0]
    
    context.log(`📅 Looking for games with event date before ${cutoffDateString}`)
    
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
      return
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
    
  } catch (error: any) {
    context.error('❌ Error during cleanup:', error)
    trackError(context, error, { requestId })
  }
}

app.timer('cleanupExpiredGames', {
  // Run at 2:00 AM UTC every day
  schedule: '0 0 2 * * *',
  handler: cleanupExpiredGames,
  // Disable timer trigger in local development
  ...(process.env.ENVIRONMENT === 'local' ? { disabled: true } : {})
})
