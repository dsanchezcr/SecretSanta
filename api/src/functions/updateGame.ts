import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getGameByCode, updateGame, getDatabaseStatus, Participant, Game, GameUpdatePayload, ReassignmentRequest } from '../shared/cosmosdb'
import { reassignParticipant, generateAssignments, generateId } from '../shared/game-utils'
import { JoinInvitationPayload } from '../shared/types'
import { 
  getEmailServiceStatus,
  sendParticipantConfirmedEmail,
  sendReassignmentRequestedEmail,
  sendReassignmentResultEmail,
  sendWishUpdatedEmail,
  sendEventDetailsChangedEmails,
  sendParticipantInvitationEmail,
  sendFullReassignmentEmails,
  sendNewOrganizerLinkEmail,
  EventChanges
} from '../shared/email-service'

export async function updateGameHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const code = request.params.code
  
  if (!code) {
    return {
      status: 400,
      jsonBody: { error: 'Game code is required' }
    }
  }
  
  context.log(`Updating game with code: ${code}`)
  
  // Check database connectivity first
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
    const body = await request.json() as GameUpdatePayload
    const game = await getGameByCode(code)
    
    if (!game) {
      return {
        status: 404,
        jsonBody: { error: 'Game not found' }
      }
    }

    // Handle organizer actions (require token validation)
    if (body.action === 'updateGameDetails' || body.action === 'addParticipant' || body.action === 'removeParticipant' || body.action === 'updateParticipantDetails' || body.action === 'approveReassignment' || body.action === 'approveAllReassignments' || body.action === 'reassignAll' || body.action === 'cancelReassignmentRequest' || body.action === 'regenerateToken' || body.action === 'regenerateOrganizerToken') {
      const organizerToken = (body as any).organizerToken
      
      if (!organizerToken || organizerToken !== game.organizerToken) {
        return {
          status: 403,
          jsonBody: { error: 'Invalid organizer token' }
        }
      }

      // Initialize reassignmentRequests if it doesn't exist
      if (!game.reassignmentRequests) {
        game.reassignmentRequests = []
      }

      if (body.action === 'updateGameDetails') {
        // Track changes for email notification
        const changes: EventChanges = {}
        const emailStatus = getEmailServiceStatus()
        
        // Update game details and track changes
        if (body.name !== undefined) game.name = body.name
        if (body.amount !== undefined) game.amount = body.amount
        if (body.currency !== undefined) game.currency = body.currency
        if (body.date !== undefined) {
          if (body.date !== game.date) {
            changes.date = { old: game.date, new: body.date }
          }
          game.date = body.date
        }
        if (body.time !== undefined) {
          if (body.time !== game.time) {
            changes.time = { old: game.time, new: body.time }
          }
          game.time = body.time
        }
        if (body.location !== undefined) {
          if (body.location !== game.location) {
            changes.location = { old: game.location, new: body.location }
          }
          game.location = body.location
        }
        if (body.generalNotes !== undefined) {
          if (body.generalNotes !== game.generalNotes) {
            changes.generalNotes = { old: game.generalNotes, new: body.generalNotes }
          }
          game.generalNotes = body.generalNotes
        }
        if (body.allowReassignment !== undefined) game.allowReassignment = body.allowReassignment
        
        // Send event details changed emails if there are relevant changes
        const hasEventChanges = Object.keys(changes).length > 0
        if (hasEventChanges && emailStatus.configured) {
          const language = (body as any).language || 'es'
          // Don't await - send in background to not block response
          sendEventDetailsChangedEmails(game, changes, language).then(result => {
            context.log(`📧 Event change emails: ${result.sent} sent, ${result.failed} failed`)
          }).catch(err => {
            context.warn(`⚠️ Failed to send event change emails: ${err.message}`)
          })
        }
        
        context.log(`Game details updated for code: ${code}`)
      }

      if (body.action === 'addParticipant') {
        const participantName = body.participantName?.trim()
        const participantEmail = (body as any).participantEmail?.trim() || undefined
        
        if (!participantName) {
          return {
            status: 400,
            jsonBody: { error: 'Participant name is required' }
          }
        }

        // Check for duplicate names
        if (game.participants.some(p => p.name.toLowerCase() === participantName.toLowerCase())) {
          return {
            status: 400,
            jsonBody: { error: 'Participant name already exists' }
          }
        }

        // Check for duplicate emails (if email is provided)
        if (participantEmail && game.participants.some(p => p.email?.toLowerCase() === participantEmail.toLowerCase())) {
          return {
            status: 400,
            jsonBody: { error: 'Participant email already exists' }
          }
        }

        const newParticipant: Participant = {
          id: generateId(),
          name: participantName,
          email: participantEmail,
          desiredGift: '',
          wish: '',
          hasConfirmedAssignment: false,
          hasPendingReassignmentRequest: false,
          token: game.isProtected ? generateId() : undefined, // Generate token for protected games
        }

        game.participants.push(newParticipant)
        
        // Regenerate assignments if we have at least 3 participants
        if (game.participants.length >= 3) {
          game.assignments = generateAssignments(game.participants)
        }
        
        // Send invitation email to new participant if they have email
        const emailStatus = getEmailServiceStatus()
        if (participantEmail && emailStatus.configured && game.participants.length >= 3) {
          const language = (body as any).language || 'es'
          // Don't await - send in background to not block response
          sendParticipantInvitationEmail(game, newParticipant, language).then(result => {
            if (result.success) {
              context.log(`📧 Invitation email sent to ${participantName}`)
            } else {
              context.warn(`⚠️ Failed to send invitation email to ${participantName}: ${result.error}`)
            }
          }).catch(err => {
            context.warn(`⚠️ Failed to send invitation email: ${err.message}`)
          })
        }
        
        context.log(`Participant '${participantName}' added to game: ${code}`)
      }

      if (body.action === 'removeParticipant') {
        const participantId = body.participantId
        
        if (!participantId) {
          return {
            status: 400,
            jsonBody: { error: 'Participant ID is required' }
          }
        }

        const participantIndex = game.participants.findIndex(p => p.id === participantId)
        
        if (participantIndex === -1) {
          return {
            status: 404,
            jsonBody: { error: 'Participant not found' }
          }
        }

        const removedParticipant = game.participants[participantIndex]
        game.participants.splice(participantIndex, 1)
        
        // Remove any pending reassignment request for this participant
        game.reassignmentRequests = game.reassignmentRequests.filter(r => r.participantId !== participantId)
        
        // Regenerate assignments if we still have at least 3 participants
        if (game.participants.length >= 3) {
          game.assignments = generateAssignments(game.participants)
        } else {
          game.assignments = []
        }
        
        context.log(`Participant '${removedParticipant.name}' removed from game: ${code}`)
      }

      if (body.action === 'updateParticipantDetails') {
        const participantId = (body as any).participantId
        
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

        // Update participant fields if provided
        if ((body as any).name !== undefined) {
          const newName = (body as any).name?.trim()
          if (!newName) {
            return {
              status: 400,
              jsonBody: { error: 'Participant name cannot be empty' }
            }
          }
          // Check for duplicate names (excluding current participant)
          if (game.participants.some(p => p.id !== participantId && p.name.toLowerCase() === newName.toLowerCase())) {
            return {
              status: 400,
              jsonBody: { error: 'Participant name already exists' }
            }
          }
          participant.name = newName
        }
        if ((body as any).email !== undefined) {
          const newEmail = (body as any).email?.trim() || undefined
          // Check for duplicate emails (excluding current participant)
          if (newEmail && game.participants.some(p => p.id !== participantId && p.email?.toLowerCase() === newEmail.toLowerCase())) {
            return {
              status: 400,
              jsonBody: { error: 'Participant email already exists' }
            }
          }
          participant.email = newEmail
        }
        if ((body as any).desiredGift !== undefined) {
          participant.desiredGift = (body as any).desiredGift?.trim() || ''
        }
        if ((body as any).wish !== undefined) {
          participant.wish = (body as any).wish?.trim() || ''
        }
        if ((body as any).hasConfirmedAssignment !== undefined) {
          participant.hasConfirmedAssignment = (body as any).hasConfirmedAssignment
        }
        
        context.log(`Participant '${participant.name}' details updated in game: ${code}`)
      }

      if (body.action === 'approveReassignment') {
        const participantId = (body as any).participantId
        
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

        // Check if there's a pending request for this participant
        const requestIndex = game.reassignmentRequests.findIndex(r => r.participantId === participantId)
        if (requestIndex === -1) {
          return {
            status: 400,
            jsonBody: { error: 'No pending reassignment request for this participant' }
          }
        }

        // Perform the reassignment (swap with another giver)
        const newAssignments = reassignParticipant(participantId, game.assignments, game.participants)
        
        if (newAssignments === null) {
          // No valid swap possible - this can happen with only 3 participants in certain configurations
          return {
            status: 400,
            jsonBody: { error: 'Cannot reassign: no valid swap available. Try regenerating all assignments.' }
          }
        }
        
        game.assignments = newAssignments
        
        // Remove the pending request and reset the flag
        game.reassignmentRequests.splice(requestIndex, 1)
        participant.hasPendingReassignmentRequest = false
        
        // Send approval email to participant
        const emailStatus = getEmailServiceStatus()
        if (participant.email && emailStatus.configured) {
          const language = (body as any).language || 'es'
          // Don't await - send in background
          sendReassignmentResultEmail(game, participant, true, language).then(result => {
            if (result.success) {
              context.log(`📧 Reassignment approval email sent to ${participant.name}`)
            } else {
              context.warn(`⚠️ Failed to send approval email to ${participant.name}: ${result.error}`)
            }
          }).catch(err => {
            context.warn(`⚠️ Failed to send approval email: ${err.message}`)
          })
        }
        
        context.log(`Reassignment approved for participant '${participant.name}' in game: ${code}.`)
      }

      if (body.action === 'approveAllReassignments') {
        // Check if there are pending requests
        if (!game.reassignmentRequests || game.reassignmentRequests.length === 0) {
          return {
            status: 400,
            jsonBody: { error: 'No pending reassignment requests' }
          }
        }

        // Process each pending request
        let approvedCount = 0
        let failedCount = 0
        for (const request of [...game.reassignmentRequests]) {
          const participant = game.participants.find(p => p.id === request.participantId)
          if (participant) {
            // Perform the reassignment for this participant (swap with another giver)
            const newAssignments = reassignParticipant(request.participantId, game.assignments, game.participants)
            if (newAssignments !== null) {
              game.assignments = newAssignments
              participant.hasPendingReassignmentRequest = false
              approvedCount++
              // Remove this request from the list
              const idx = game.reassignmentRequests.findIndex(r => r.participantId === request.participantId)
              if (idx !== -1) {
                game.reassignmentRequests.splice(idx, 1)
              }
            } else {
              // Could not reassign this participant - leave request pending
              failedCount++
            }
          }
        }
        
        if (approvedCount === 0 && failedCount > 0) {
          return {
            status: 400,
            jsonBody: { error: 'Could not approve any reassignments. Try regenerating all assignments.' }
          }
        }
        
        context.log(`Approved ${approvedCount} reassignment requests for game: ${code}. ${failedCount} could not be processed.`)
      }

      if (body.action === 'reassignAll') {
        if (game.participants.length < 3) {
          return {
            status: 400,
            jsonBody: { error: 'Need at least 3 participants to generate assignments' }
          }
        }
        
        // Track participants who had confirmed before reassignment (for email notification)
        const confirmedParticipants = game.participants.filter(p => p.hasConfirmedAssignment && p.email)
        
        // Regenerate all assignments
        game.assignments = generateAssignments(game.participants)
        
        // Clear all pending reassignment requests and reset confirmation status
        game.reassignmentRequests = []
        game.participants.forEach(p => {
          p.hasPendingReassignmentRequest = false
          p.hasConfirmedAssignment = false
        })
        
        // Send email notifications to participants who had confirmed their assignments
        const emailStatus = getEmailServiceStatus()
        if (confirmedParticipants.length > 0 && emailStatus.configured) {
          const language = (body as any).language || 'es'
          // Don't await - send in background to not block response
          sendFullReassignmentEmails(game, confirmedParticipants, language).then(result => {
            context.log(`📧 Full reassignment emails: ${result.sent} sent, ${result.failed} failed`)
          }).catch(err => {
            context.warn(`⚠️ Failed to send full reassignment emails: ${err.message}`)
          })
        }
        
        context.log(`All assignments regenerated for game: ${code}. ${confirmedParticipants.length} confirmed participants will be notified.`)
      }

      if (body.action === 'cancelReassignmentRequest') {
        const participantId = (body as any).participantId
        
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

        // Remove the pending request
        const requestIndex = game.reassignmentRequests.findIndex(r => r.participantId === participantId)
        if (requestIndex !== -1) {
          game.reassignmentRequests.splice(requestIndex, 1)
        }
        participant.hasPendingReassignmentRequest = false
        
        // Send rejection email to participant
        const emailStatus = getEmailServiceStatus()
        if (participant.email && emailStatus.configured) {
          const language = (body as any).language || 'es'
          // Don't await - send in background
          sendReassignmentResultEmail(game, participant, false, language).then(result => {
            if (result.success) {
              context.log(`📧 Reassignment rejection email sent to ${participant.name}`)
            } else {
              context.warn(`⚠️ Failed to send rejection email to ${participant.name}: ${result.error}`)
            }
          }).catch(err => {
            context.warn(`⚠️ Failed to send rejection email: ${err.message}`)
          })
        }
        
        context.log(`Reassignment request cancelled for participant '${participant.name}' in game: ${code}`)
      }

      if (body.action === 'regenerateToken') {
        const participantId = (body as any).participantId

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

        // Regenerate the participant's token
        const oldToken = participant.token
        participant.token = generateId()
        
        context.log(`Token regenerated for participant '${participant.name}' in game: ${code}`)
      }

      if (body.action === 'regenerateOrganizerToken') {
        // Regenerate organizer token requires email service to be configured
        // because the only way to recover access is via email
        const emailStatus = getEmailServiceStatus()
        if (!emailStatus.configured) {
          return {
            status: 400,
            jsonBody: { error: 'Email service not configured. Cannot regenerate organizer token without email.' }
          }
        }

        if (!game.organizerEmail) {
          return {
            status: 400,
            jsonBody: { error: 'No organizer email configured. Cannot send new access link.' }
          }
        }

        // Generate new organizer token
        const oldToken = game.organizerToken
        game.organizerToken = generateId()
        
        const language = (body as any).language || 'es'

        // Save the game first to ensure token is updated
        await updateGame(game)
        
        // Send email with new organizer link
        const emailResult = await sendNewOrganizerLinkEmail(game, language)
        if (!emailResult.success) {
          // Rollback the token change
          game.organizerToken = oldToken
          await updateGame(game)
          return {
            status: 500,
            jsonBody: { error: `Failed to send email with new link: ${emailResult.error}` }
          }
        }
        
        context.log(`Organizer token regenerated for game: ${code}. New link sent to ${game.organizerEmail}`)
        
        // Return success without the game data (since the caller's token is now invalid)
        return {
          status: 200,
          jsonBody: { 
            success: true, 
            message: 'Organizer token regenerated. Check your email for the new link.',
            emailSent: true
          }
        }
      }
    }
    
    // Handle participant actions (no token required)
    if (body.action === 'confirmAssignment' && body.participantId) {
      const participant = game.participants.find((p: Participant) => p.id === body.participantId)
      if (participant) {
        participant.hasConfirmedAssignment = true
        
        // Store participant's language preference if email is configured
        const emailStatus = getEmailServiceStatus()
        if (emailStatus.configured && (body as any).language) {
          participant.preferredLanguage = (body as any).language
        }
        
        context.log(`Assignment confirmed by participant '${participant.name}' in game: ${code}`)
        
        // Send confirmation email to organizer
        if (game.organizerEmail && emailStatus.configured) {
          const language = (body as any).language || 'es'
          // Don't await - send in background
          sendParticipantConfirmedEmail(game, participant, language).then(result => {
            if (result.success) {
              context.log(`📧 Confirmation notification sent to organizer`)
            } else {
              context.warn(`⚠️ Failed to send confirmation email to organizer: ${result.error}`)
            }
          }).catch(err => {
            context.warn(`⚠️ Failed to send confirmation email: ${err.message}`)
          })
        }
      }
    }
    
    if (body.action === 'requestReassignment' && body.participantId) {
      const participant = game.participants.find((p: Participant) => p.id === body.participantId)
      
      if (!participant) {
        return {
          status: 404,
          jsonBody: { error: 'Participant not found' }
        }
      }
      
      if (!game.allowReassignment) {
        return {
          status: 400,
          jsonBody: { error: 'Reassignment not allowed for this game' }
        }
      }

      // Initialize reassignmentRequests if it doesn't exist
      if (!game.reassignmentRequests) {
        game.reassignmentRequests = []
      }
      
      // Check if already has a pending request
      if (participant.hasPendingReassignmentRequest) {
        return {
          status: 400,
          jsonBody: { error: 'Reassignment already requested' }
        }
      }
      
      // Store participant's language preference if email is configured
      const emailStatus = getEmailServiceStatus()
      if (emailStatus.configured && (body as any).language) {
        participant.preferredLanguage = (body as any).language
      }
      
      // Add to pending requests instead of performing reassignment immediately
      const request: ReassignmentRequest = {
        participantId: body.participantId,
        participantName: participant.name,
        requestedAt: Date.now()
      }
      game.reassignmentRequests.push(request)
      participant.hasPendingReassignmentRequest = true
      
      // Send email to organizer about the reassignment request
      if (game.organizerEmail && emailStatus.configured) {
        const language = (body as any).language || 'es'
        // Don't await - send in background
        sendReassignmentRequestedEmail(game, participant, language).then(result => {
          if (result.success) {
            context.log(`📧 Reassignment request notification sent to organizer`)
          } else {
            context.warn(`⚠️ Failed to send reassignment request email to organizer: ${result.error}`)
          }
        }).catch(err => {
          context.warn(`⚠️ Failed to send reassignment request email: ${err.message}`)
        })
      }
      
      context.log(`Reassignment request submitted for participant '${participant.name}' in game: ${code}`)
    }

    // Handle updateWish action (no token required - participants can update their own wish)
    if (body.action === 'updateWish' && body.participantId) {
      const participant = game.participants.find((p: Participant) => p.id === body.participantId)
      
      if (!participant) {
        return {
          status: 404,
          jsonBody: { error: 'Participant not found' }
        }
      }
      
      const oldWish = participant.wish
      participant.wish = (body as any).wish || ''
      
      // Store participant's language preference if email is configured
      const emailStatus = getEmailServiceStatus()
      if (emailStatus.configured && (body as any).language) {
        participant.preferredLanguage = (body as any).language
      }
      
      context.log(`Wish updated for participant '${participant.name}' in game: ${code}`)
      
      // Send email to the giver when wish is updated (only if wish actually changed)
      if (emailStatus.configured && participant.wish !== oldWish) {
        const language = (body as any).language || 'es'
        // Don't await - send in background
        sendWishUpdatedEmail(game, participant, language).then(result => {
          if (result.success) {
            context.log(`📧 Wish update notification sent to giver`)
          } else {
            context.warn(`⚠️ Failed to send wish update email: ${result.error}`)
          }
        }).catch(err => {
          context.warn(`⚠️ Failed to send wish update email: ${err.message}`)
        })
      }
    }

    // Handle updateParticipantEmail action (no token required - participants can update their own email)
    if (body.action === 'updateParticipantEmail' && body.participantId) {
      const participant = game.participants.find((p: Participant) => p.id === body.participantId)
      
      if (!participant) {
        return {
          status: 404,
          jsonBody: { error: 'Participant not found' }
        }
      }
      
      const newEmail = (body as any).email?.trim() || undefined
      // Check for duplicate emails (excluding current participant)
      if (newEmail && game.participants.some((p: Participant) => p.id !== body.participantId && p.email?.toLowerCase() === newEmail.toLowerCase())) {
        return {
          status: 400,
          jsonBody: { error: 'Participant email already exists' }
        }
      }
      
      participant.email = newEmail
      
      // Store participant's language preference if email is configured
      const emailStatus = getEmailServiceStatus()
      if (emailStatus.configured && (body as any).language) {
        participant.preferredLanguage = (body as any).language
      }
      
      context.log(`Email updated for participant '${participant.name}' in game: ${code}`)
    }

    // Handle joinInvitation action (new participants joining via invitation link)
    if (body.action === 'joinInvitation') {
      const payload = body as JoinInvitationPayload
      const invitationToken = payload.invitationToken
      const participantName = payload.participantName?.trim()
      const participantEmail = payload.participantEmail?.trim()
      const desiredGift = payload.desiredGift?.trim() || ''
      const wish = payload.wish?.trim() || ''
      const language = payload.language
      
      // Validate invitation token
      if (!invitationToken || invitationToken !== game.invitationToken) {
        return {
          status: 403,
          jsonBody: { 
            error: 'Invalid invitation token',
            code: 'INVALID_INVITATION_TOKEN'
          }
        }
      }
      
      // Validate participant name
      if (!participantName) {
        return {
          status: 400,
          jsonBody: { 
            error: 'Participant name is required',
            code: 'PARTICIPANT_NAME_REQUIRED'
          }
        }
      }
      
      // Check for duplicate participant names (case-insensitive)
      if (game.participants.some(p => p.name.toLowerCase() === participantName.toLowerCase())) {
        return {
          status: 400,
          jsonBody: { 
            error: 'Participant name already exists',
            code: 'DUPLICATE_NAME'
          }
        }
      }
      
      // Check for duplicate emails if email is provided (case-insensitive)
      if (participantEmail && game.participants.some(p => 
        p.email && p.email.toLowerCase() === participantEmail.toLowerCase()
      )) {
        return {
          status: 400,
          jsonBody: { 
            error: 'Email address already in use',
            code: 'DUPLICATE_EMAIL'
          }
        }
      }
      
      // Check if email service is configured to determine if we should store language preferences
      const emailStatus = getEmailServiceStatus()
      const storeLanguagePreference = emailStatus.configured
      
      // Create new participant
      const newParticipant: Participant = {
        id: generateId(),
        name: participantName,
        email: participantEmail || undefined,
        desiredGift,
        wish,
        hasConfirmedAssignment: false,
        hasPendingReassignmentRequest: false,
        token: game.isProtected ? generateId() : undefined,
        preferredLanguage: storeLanguagePreference && language ? language : undefined
      }
      
      // Add participant to game
      game.participants.push(newParticipant)
      
      // Regenerate assignments to include new participant
      game.assignments = generateAssignments(game.participants)
      
      // Clear any pending reassignment requests since we're regenerating all assignments
      game.reassignmentRequests = []
      game.participants.forEach(p => {
        p.hasPendingReassignmentRequest = false
        p.hasConfirmedAssignment = false // Clear confirmations when regenerating
      })
      
      context.log(`New participant '${participantName}' joined game via invitation: ${code}`)
      
      // Send welcome email to new participant if email is configured
      if (newParticipant.email && emailStatus.configured) {
        const emailLanguage = language || 'es'
        sendParticipantInvitationEmail(game, newParticipant, emailLanguage).then(result => {
          if (result.success) {
            context.log(`📧 Welcome email sent to new participant ${participantName}`)
          } else {
            context.warn(`⚠️ Failed to send welcome email to ${participantName}: ${result.error}`)
          }
        }).catch(err => {
          context.warn(`⚠️ Failed to send welcome email: ${err.message}`)
        })
      }
      
      // Return updated game with the new participant's ID
      const updatedGame = await updateGame(game)
      return {
        status: 200,
        jsonBody: {
          game: updatedGame,
          participantId: newParticipant.id
        }
      }
    }
    
    const updatedGame = await updateGame(game)
    
    return {
      status: 200,
      jsonBody: updatedGame
    }
  } catch (error: any) {
    context.error('Error updating game:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to update game', details: error.message }
    }
  }
}

app.http('updateGame', {
  methods: ['PUT', 'PATCH'],
  authLevel: 'anonymous',
  route: 'games/{code}',
  handler: updateGameHandler
})
