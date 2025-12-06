import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getGameByCode, getDatabaseStatus } from '../shared/cosmosdb'
import { 
  getEmailServiceStatus, 
  sendOrganizerEmail, 
  sendParticipantAssignmentEmail,
  sendAllParticipantEmails,
  sendReminderEmail,
  sendReminderToAllParticipants,
  sendOrganizerRecoveryEmail,
  sendParticipantRecoveryEmail
} from '../shared/email-service'

export async function sendEmailHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Processing send email request')

  // Check if email service is configured
  const emailStatus = getEmailServiceStatus()
  if (!emailStatus.configured) {
    return {
      status: 503,
      jsonBody: {
        error: 'Email service not configured',
        details: 'Azure Communication Services is not configured. Set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS environment variables.'
      }
    }
  }

  // Check database connectivity
  const dbStatus = getDatabaseStatus()
  if (!dbStatus.connected) {
    return {
      status: 503,
      jsonBody: {
        error: 'Database not available',
        details: dbStatus.error
      }
    }
  }

  try {
    const body = await request.json() as any
    const { code, type, organizerToken, participantId, language = 'es', customMessage } = body

    if (!code) {
      return {
        status: 400,
        jsonBody: { error: 'Game code is required' }
      }
    }

    if (!type || !['organizer', 'participant', 'allParticipants', 'reminder', 'reminderAll', 'recoverOrganizerLink', 'recoverParticipantLink'].includes(type)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid email type. Must be: organizer, participant, allParticipants, reminder, reminderAll, recoverOrganizerLink, or recoverParticipantLink' }
      }
    }

    // Get the game
    const game = await getGameByCode(code)
    if (!game) {
      return {
        status: 404,
        jsonBody: { error: 'Game not found' }
      }
    }

    // Handle organizer link recovery - no auth required, email verification only
    // This must be checked BEFORE the organizer token validation
    if (type === 'recoverOrganizerLink') {
      const { email } = body
      
      if (!email) {
        return {
          status: 400,
          jsonBody: { error: 'Email address is required for link recovery' }
        }
      }

      // Check if the game has an organizer email registered
      if (!game.organizerEmail) {
        // Don't reveal if game has no email - just say we can't recover
        return {
          status: 400,
          jsonBody: { 
            error: 'Cannot recover link',
            code: 'NO_EMAIL_REGISTERED',
            message: 'This game does not have an organizer email registered. Link recovery is not possible.'
          }
        }
      }

      // Verify the email matches (case-insensitive)
      if (game.organizerEmail.toLowerCase() !== email.toLowerCase()) {
        // For security, don't reveal if email doesn't match
        // Just say email was sent if it matched (standard practice)
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'If this email is registered as the organizer, a recovery link has been sent.'
          }
        }
      }

      // Email matches - send the recovery email
      const result = await sendOrganizerRecoveryEmail(game, language)
      if (result.success) {
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'If this email is registered as the organizer, a recovery link has been sent.'
          }
        }
      } else {
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to send recovery email', 
            details: result.error 
          }
        }
      }
    }

    // Handle participant link recovery - no auth required, email verification only
    // This must be checked BEFORE the organizer token validation
    if (type === 'recoverParticipantLink') {
      const { email } = body
      
      if (!email) {
        return {
          status: 400,
          jsonBody: { error: 'Email address is required for link recovery' }
        }
      }

      // Find participant by email (case-insensitive)
      const participant = game.participants.find(
        p => p.email && p.email.toLowerCase() === email.toLowerCase()
      )

      if (!participant) {
        // For security, don't reveal if email doesn't match any participant
        // Just say email was sent if it matched (standard practice)
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'If this email is registered as a participant, a recovery link has been sent.'
          }
        }
      }

      // Email matches a participant - send the recovery email
      const result = await sendParticipantRecoveryEmail(game, participant, language)
      if (result.success) {
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'If this email is registered as a participant, a recovery link has been sent.'
          }
        }
      } else {
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to send recovery email', 
            details: result.error 
          }
        }
      }
    }

    // For organizer-level actions, require organizer token
    if (['organizer', 'allParticipants', 'reminder', 'reminderAll'].includes(type) && game.organizerToken !== organizerToken) {
      return {
        status: 403,
        jsonBody: { error: 'Invalid organizer token' }
      }
    }

    // Handle different email types
    if (type === 'organizer') {
      if (!game.organizerEmail) {
        return {
          status: 400,
          jsonBody: { error: 'No organizer email configured for this game' }
        }
      }

      const result = await sendOrganizerEmail(game, language)
      if (result.success) {
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'Organizer email sent successfully' 
          }
        }
      } else {
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to send organizer email', 
            details: result.error 
          }
        }
      }
    }

    if (type === 'participant') {
      if (!participantId) {
        return {
          status: 400,
          jsonBody: { error: 'Participant ID is required' }
        }
      }

      const participant = game.participants.find(p => p.id === participantId)
      if (!participant) {
        return {
          status: 404,
          jsonBody: { error: 'Participant not found' }
        }
      }

      if (!participant.email) {
        return {
          status: 400,
          jsonBody: { error: 'Participant does not have an email address' }
        }
      }

      const result = await sendParticipantAssignmentEmail(game, participant, language)
      if (result.success) {
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: `Email sent to ${participant.name}` 
          }
        }
      } else {
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to send participant email', 
            details: result.error 
          }
        }
      }
    }

    if (type === 'allParticipants') {
      const participantsWithEmail = game.participants.filter(p => p.email)
      
      if (participantsWithEmail.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'No participants have email addresses configured' }
        }
      }

      const results = await sendAllParticipantEmails(game, language)
      
      return {
        status: 200,
        jsonBody: {
          success: true,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
          message: `Sent ${results.sent} emails, ${results.failed} failed`
        }
      }
    }

    // Handle reminder email to a specific participant
    if (type === 'reminder') {
      if (!participantId) {
        return {
          status: 400,
          jsonBody: { error: 'Participant ID is required for reminder emails' }
        }
      }

      const participant = game.participants.find(p => p.id === participantId)
      if (!participant) {
        return {
          status: 404,
          jsonBody: { error: 'Participant not found' }
        }
      }

      if (!participant.email) {
        return {
          status: 400,
          jsonBody: { error: 'Participant does not have an email address' }
        }
      }

      const result = await sendReminderEmail(game, participant, customMessage, language)
      if (result.success) {
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: `Reminder email sent to ${participant.name}` 
          }
        }
      } else {
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to send reminder email', 
            details: result.error 
          }
        }
      }
    }

    // Handle reminder email to all participants
    if (type === 'reminderAll') {
      const participantsWithEmail = game.participants.filter(p => p.email)
      
      if (participantsWithEmail.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'No participants have email addresses configured' }
        }
      }

      const results = await sendReminderToAllParticipants(game, customMessage, language)
      
      return {
        status: 200,
        jsonBody: {
          success: true,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
          message: `Sent ${results.sent} reminder emails, ${results.failed} failed`
        }
      }
    }

    return {
      status: 400,
      jsonBody: { error: 'Invalid request' }
    }
  } catch (error: any) {
    context.error('Error sending email:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to send email', details: error.message }
    }
  }
}

app.http('sendEmail', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'email/send',
  handler: sendEmailHandler
})
