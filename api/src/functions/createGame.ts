import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { createGame, Game, getDatabaseStatus, getGameByCode } from '../shared/cosmosdb'
import { generateGameCode, generateId, generateAssignmentsWithResult, validateDateString } from '../shared/game-utils'
import { getEmailServiceStatus, sendOrganizerEmail, sendAllParticipantEmails } from '../shared/email-service'
import { trackError, trackEvent, ApiErrorCode, createErrorResponse, getHttpStatusForError } from '../shared/telemetry'
import { CreateGamePayload, INPUT_LIMITS, validateLength } from '../shared/types'
import { checkRateLimit } from '../shared/rate-limiter'

export async function createGameHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = context.invocationId
  context.log(`Creating new game [requestId: ${requestId}]`)

  // Rate limit check
  const rateLimitResponse = checkRateLimit(request, 'createGame')
  if (rateLimitResponse) return rateLimitResponse
  
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

    // Validate input lengths to prevent abuse
    if (body.participants.length > INPUT_LIMITS.MAX_PARTICIPANTS) {
      return {
        status: getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR),
        jsonBody: { error: `Maximum ${INPUT_LIMITS.MAX_PARTICIPANTS} participants allowed` }
      }
    }
    const lengthErrors = [
      validateLength('Game name', body.name, INPUT_LIMITS.GAME_NAME),
      validateLength('Location', body.location, INPUT_LIMITS.LOCATION),
      validateLength('Amount', body.amount, INPUT_LIMITS.AMOUNT),
      validateLength('Currency', body.currency, INPUT_LIMITS.CURRENCY),
      validateLength('General notes', body.generalNotes, INPUT_LIMITS.GENERAL_NOTES),
      validateLength('Organizer email', body.organizerEmail, INPUT_LIMITS.EMAIL),
      ...body.participants.flatMap((p, index) => [
        validateLength(`Participant #${index + 1} name`, p.name, INPUT_LIMITS.PARTICIPANT_NAME),
        validateLength(`Participant #${index + 1} desired gift`, p.desiredGift, INPUT_LIMITS.DESIRED_GIFT),
        validateLength(`Participant #${index + 1} wish`, p.wish, INPUT_LIMITS.WISH),
        validateLength(`Participant #${index + 1} email`, p.email, INPUT_LIMITS.EMAIL),
      ])
    ].filter(Boolean)

    if (lengthErrors.length > 0) {
      return {
        status: getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR),
        jsonBody: { error: lengthErrors[0] }
      }
    }
    
    // Validate event date is today or in the future
    if (body.date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Validate date format and calendar validity using shared utility
      const dateValidation = validateDateString(body.date)
      if (!dateValidation.valid) {
        const error = createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          dateValidation.error,
          undefined,
          requestId
        )
        return {
          status: getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR),
          jsonBody: { error: error.message }
        }
      }
      
      // Create date in local timezone for comparison
      const { year, month, day } = dateValidation
      const eventDate = new Date(year, month - 1, day)
      
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
    // Generate game code with collision check (retry up to 5 times)
    let gameCode = generateGameCode()
    let foundUniqueCode = false
    for (let i = 0; i < 5; i++) {
      const existing = await getGameByCode(gameCode)
      if (!existing) {
        foundUniqueCode = true
        break
      }
      gameCode = generateGameCode()
    }
    if (!foundUniqueCode) {
      const error = createErrorResponse(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to generate unique game code',
        undefined,
        requestId
      )
      return {
        status: getHttpStatusForError(ApiErrorCode.DATABASE_ERROR),
        jsonBody: { error: error.message }
      }
    }
    const organizerToken = generateId()
    const invitationToken = generateId()
    
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
    
    const exclusions = body.exclusions || []
    const assignmentResult = generateAssignmentsWithResult(participants, exclusions)
    const assignments = assignmentResult.assignments
    
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
      exclusions,
      organizerToken,
      organizerEmail: body.organizerEmail || undefined, // Optional organizer email
      // Only store organizer language preference if email service is configured
      organizerLanguage: storeLanguagePreference && body.language ? body.language : undefined,
      invitationToken, // Token for invitation link
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
        emailResults: emailStatus.configured ? emailResults : undefined,
        exclusionsHonored: exclusions.length > 0 ? assignmentResult.exclusionsHonored : undefined
      }
    }
  } catch (error: any) {
    context.error('Error creating game:', error)
    trackError(context, error, { requestId })
    return {
      status: 500,
      jsonBody: { error: 'Failed to create game' }
    }
  }
}

app.http('createGame', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'games',
  handler: createGameHandler
})
