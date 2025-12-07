import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getGameByCode, getDatabaseStatus, Game } from '../shared/cosmosdb'

export async function getGameHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const code = request.params.code
  
  if (!code) {
    return {
      status: 400,
      jsonBody: { error: 'Game code is required' }
    }
  }
  
  context.log(`Getting game with code: ${code}`)
  
  // Get optional query parameters for token-based access
  const participantToken = request.query.get('participantToken')
  const organizerToken = request.query.get('organizerToken')
  const participantId = request.query.get('participantId') // For non-protected games to filter assignments
  
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
    const game = await getGameByCode(code)
    
    if (!game) {
      return {
        status: 404,
        jsonBody: { error: 'Game not found' }
      }
    }
    
    // If game is protected, handle access control
    if (game.isProtected) {
      // Organizer has full access
      if (organizerToken && organizerToken === game.organizerToken) {
        return {
          status: 200,
          jsonBody: game
        }
      }
      
      // Participant with valid token gets limited view (only their participant info)
      if (participantToken) {
        const participant = game.participants.find(p => p.token === participantToken)
        if (participant) {
          // Find who this participant is giving to (their assignment)
          const participantAssignment = game.assignments.find(a => a.giverId === participant.id)
          // Find who is giving to this participant (to check if giver has confirmed)
          const giverAssignment = game.assignments.find(a => a.receiverId === participant.id)
          const giver = giverAssignment ? game.participants.find(p => p.id === giverAssignment.giverId) : undefined
          
          // Return game with only this participant's info and their receiver's info
          // Hide all other assignments to prevent spoiling the game
          const sanitizedGame: Game = {
            ...game,
            participants: game.participants.map(p => ({
              ...p,
              token: p.id === participant.id ? p.token : undefined, // Only show own token
              email: p.id === participant.id ? p.email : undefined, // Only show own email
            })),
            // Only include this participant's assignment (not giver's assignment to preserve surprise)
            assignments: participantAssignment ? [participantAssignment] : [],
            organizerToken: '', // Hide organizer token
            organizerEmail: undefined, // Hide organizer email
          }
          return {
            status: 200,
            jsonBody: {
              ...sanitizedGame,
              authenticatedParticipantId: participant.id, // Tell frontend which participant is authenticated
              giverHasConfirmed: giver?.hasConfirmedAssignment || false // Flag for giver confirmation status without revealing identity
            }
          }
        }
        // Invalid participant token
        return {
          status: 403,
          jsonBody: { error: 'Invalid participant token' }
        }
      }
      
      // No token provided for protected game - return minimal info
      return {
        status: 200,
        jsonBody: {
          code: game.code,
          name: game.name,
          isProtected: true,
          requiresToken: true // Signal to frontend that token is needed
        }
      }
    }
    
    // Non-protected game
    // If organizer token is provided and valid, return full game
    if (organizerToken && organizerToken === game.organizerToken) {
      return {
        status: 200,
        jsonBody: game
      }
    }
    
    // If participantId is provided, filter assignments for that participant (even for non-protected games)
    if (participantId) {
      const participant = game.participants.find(p => p.id === participantId)
      if (participant) {
        // Find this participant's assignment and giver assignment
        const participantAssignment = game.assignments.find(a => a.giverId === participantId)
        const giverAssignment = game.assignments.find(a => a.receiverId === participantId)
        const giver = giverAssignment ? game.participants.find(p => p.id === giverAssignment.giverId) : undefined
        
        // Return filtered game for this participant
        const filteredGame = {
          ...game,
          organizerToken: '', // Hide organizer token
          participants: game.participants.map(p => ({
            ...p,
            token: undefined // Don't expose tokens
          })),
          assignments: participantAssignment ? [participantAssignment] : []
        }
        
        return {
          status: 200,
          jsonBody: {
            ...filteredGame,
            authenticatedParticipantId: participantId,
            giverHasConfirmed: giver?.hasConfirmedAssignment || false
          }
        }
      }
      // If participantId is provided but not found, return 404
      return {
        status: 404,
        jsonBody: { error: 'Participant not found' }
      }
    }
    
    // Otherwise return game data without sensitive tokens and without assignments
    // Do not leak assignments to anonymous users - they must select a participant first
    const publicGame = {
      ...game,
      organizerToken: '', // Hide organizer token from public access
      participants: game.participants.map(p => ({
        ...p,
        token: undefined // Don't expose tokens even in non-protected games
      })),
      assignments: [] // Do not leak assignments to anonymous users
    }
    
    return {
      status: 200,
      jsonBody: publicGame
    }
  } catch (error: any) {
    context.error('Error getting game:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to get game', details: error.message }
    }
  }
}

app.http('getGame', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'games/{code}',
  handler: getGameHandler
})
