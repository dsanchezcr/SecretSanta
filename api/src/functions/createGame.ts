import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { createGame, Game, getDatabaseStatus } from '../shared/cosmosdb'
import { generateGameCode, generateId, generateAssignments } from '../shared/game-utils'
import { getEmailServiceStatus, sendOrganizerEmail, sendAllParticipantEmails } from '../shared/email-service'
import { trackError, trackEvent, ApiErrorCode, createErrorResponse, getHttpStatusForError } from '../shared/telemetry'
import { CreateGamePayload } from '../shared/types'

export async function createGameHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = context.invocationId
  context.log(`Creating new game [requestId: ${requestId}]`)
  
  // Check database connectivity first
  const dbStatus = getDatabaseStatus()
  if (!dbStatus.connected) {
    const error = createErrorResponse(
      ApiErrorCode.SERVICE_UNAVAILABLE,
      'Database not available',
      dbStatus.error || undefined,
      requestId
    )
    trackError(context, new Error('Database not available'), { requestId })
    return {
      status: getHttpStatusForError(ApiErrorCode.SERVICE_UNAVAILABLE),
      jsonBody: { error: error.message, details: error.details }
    }
  }
  
  try {
    const body = await request.json() as CreateGamePayload
    
    if (!body.name || !body.participants || body.participants.length < 3) {
      const error = createErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid game data. Need at least 3 participants.',
        undefined,
        requestId
      )
      return {
        status: getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR),
        jsonBody: { error: error.message }
      }
    }
    
    // Validate event date is today or in the future
    if (body.date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const eventDate = new Date(body.date)
      eventDate.setHours(0, 0, 0, 0)
      
      if (eventDate < today) {
        const error = createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'Event date must be today or in the future',
          undefined,
          requestId
        )
        return {
          status: getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR),
          jsonBody: { error: error.message }
        }
      }
    }
    
    const gameId = generateId()
    const gameCode = generateGameCode()
    const organizerToken = generateId()
    
    const isProtected = body.isProtected !== false // Default to true
    
    // Check if email service is configured to determine if we should store language preferences
    const emailStatus = getEmailServiceStatus()
    const storeLanguagePreference = emailStatus.configured
    
    const participants = body.participants.map((p) => ({
      id: generateId(),
      name: p.name,
      email: p.email || undefined,
      desiredGift: p.desiredGift || '',
      wish: p.wish || '',
      hasConfirmedAssignment: false,
      hasPendingReassignmentRequest: false,
      token: isProtected ? generateId() : undefined,
      // Only store preferred language if email service is configured
      preferredLanguage: storeLanguagePreference && body.language ? body.language : undefined
    }))
    
    const assignments = generateAssignments(participants)
    
    const game: Game = {
      id: gameId,
      code: gameCode,
      name: body.name,
      amount: body.amount || '',
      currency: body.currency || 'USD',
      date: body.date || '',
      time: body.time || undefined,
      location: body.location || '',
      allowReassignment: body.allowReassignment !== false,
      isProtected,
      generalNotes: body.generalNotes || '',
      participants,
      assignments,
      reassignmentRequests: [],
      organizerToken,
      organizerEmail: body.organizerEmail || undefined, // Optional organizer email
      // Only store organizer language preference if email service is configured
      organizerLanguage: storeLanguagePreference && body.language ? body.language : undefined,
      createdAt: Date.now()
    }
    
    const createdGame = await createGame(game)
    
    // Send emails if email service is configured and emails are provided
    let emailResults = {
      organizerEmailSent: false,
      participantEmailsSent: 0,
      participantEmailsFailed: 0
    }
    
    if (emailStatus.configured && body.sendEmails !== false) {
      const language = body.language || 'es'
      
      // Send organizer email if provided
      if (game.organizerEmail) {
        const organizerResult = await sendOrganizerEmail(game, language)
        emailResults.organizerEmailSent = organizerResult.success
        if (organizerResult.success) {
          context.log(`✅ Organizer email sent to ${game.organizerEmail}`)
        } else {
          context.warn(`⚠️ Failed to send organizer email: ${organizerResult.error}`)
        }
      }
      
      // Send participant emails if any have email addresses
      const participantsWithEmail = game.participants.filter(p => p.email)
      if (participantsWithEmail.length > 0) {
        const participantResults = await sendAllParticipantEmails(game, language)
        emailResults.participantEmailsSent = participantResults.sent
        emailResults.participantEmailsFailed = participantResults.failed
        context.log(`📧 Participant emails: ${participantResults.sent} sent, ${participantResults.failed} failed`)
      }
    }
    
    return {
      status: 201,
      jsonBody: {
        ...createdGame,
        emailResults: emailStatus.configured ? emailResults : undefined
      }
    }
  } catch (error: any) {
    context.error('Error creating game:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to create game', details: error.message }
    }
  }
}

app.http('createGame', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'games',
  handler: createGameHandler
})
