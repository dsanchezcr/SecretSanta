import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getGameByCode, deleteGame, getDatabaseStatus } from '../shared/cosmosdb'
import { trackError, trackEvent, ApiErrorCode, createErrorResponse, getHttpStatusForError } from '../shared/telemetry'

export async function deleteGameHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = context.invocationId
  const gameCode = request.params.code
  const organizerToken = request.query.get('organizerToken') || request.headers.get('x-organizer-token')
  
  context.log(`Delete game request for code: ${gameCode} [requestId: ${requestId}]`)
  
  // Check database connectivity first
  const dbStatus = getDatabaseStatus()
  if (!dbStatus.connected) {
    const error = createErrorResponse(
      ApiErrorCode.SERVICE_UNAVAILABLE,
      'Database not available',
      dbStatus.error || undefined,
      requestId
    )
    trackError(context, new Error('Database not available'), { requestId, gameCode })
    return {
      status: getHttpStatusForError(ApiErrorCode.SERVICE_UNAVAILABLE),
      jsonBody: { error: error.message, details: error.details }
    }
  }
  
  try {
    // Validate organizer token is provided
    if (!organizerToken) {
      const error = createErrorResponse(
        ApiErrorCode.UNAUTHORIZED,
        'Organizer token is required to delete a game',
        undefined,
        requestId
      )
      return {
        status: getHttpStatusForError(ApiErrorCode.UNAUTHORIZED),
        jsonBody: { error: error.message }
      }
    }
    
    // Find the game
    const game = await getGameByCode(gameCode)
    
    if (!game) {
      const error = createErrorResponse(
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        undefined,
        requestId
      )
      return {
        status: getHttpStatusForError(ApiErrorCode.NOT_FOUND),
        jsonBody: { error: error.message }
      }
    }
    
    // Validate organizer token
    if (game.organizerToken !== organizerToken) {
      const error = createErrorResponse(
        ApiErrorCode.FORBIDDEN,
        'Invalid organizer token',
        undefined,
        requestId
      )
      trackEvent(context, 'UnauthorizedDeleteAttempt', { requestId, gameCode })
      return {
        status: getHttpStatusForError(ApiErrorCode.FORBIDDEN),
        jsonBody: { error: error.message }
      }
    }
    
    // Delete the game
    await deleteGame(game.id)
    
    trackEvent(context, 'GameDeleted', { 
      requestId, 
      gameCode,
      participantCount: String(game.participants.length),
      eventDate: game.date
    })
    
    context.log(`✅ Game ${gameCode} deleted by organizer [requestId: ${requestId}]`)
    
    return {
      status: 200,
      jsonBody: { 
        success: true, 
        message: 'Game deleted successfully',
        deletedCode: gameCode
      }
    }
    
  } catch (error: any) {
    context.error('Error deleting game:', error)
    trackError(context, error, { requestId, gameCode })
    return {
      status: 500,
      jsonBody: { error: 'Failed to delete game', details: error.message }
    }
  }
}

app.http('deleteGame', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'games/{code}',
  handler: deleteGameHandler
})
