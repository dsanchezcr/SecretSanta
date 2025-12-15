/**
 * Local game operations for offline-first functionality
 * These functions modify game state locally when API is unavailable
 */

import { Game, Participant, Assignment } from './types'

// Generate a simple unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Generate a simple token
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * Request reassignment for a participant (local)
 */
export function requestReassignmentLocal(game: Game, participantId: string): Game {
  const participant = game.participants.find(p => p.id === participantId)
  if (!participant) throw new Error('Participant not found')

  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, hasPendingReassignmentRequest: true } : p
  )

  const newRequest = {
    participantId,
    participantName: participant.name,
    requestedAt: Date.now()
  }

  return {
    ...game,
    participants: updatedParticipants,
    reassignmentRequests: [...(game.reassignmentRequests || []), newRequest]
  }
}

/**
 * Update participant wish (local)
 */
export function updateWishLocal(game: Game, participantId: string, wish: string): Game {
  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, wish: wish.trim() } : p
  )
  return { ...game, participants: updatedParticipants }
}

/**
 * Update participant email (local)
 */
export function updateParticipantEmailLocal(game: Game, participantId: string, email: string): Game {
  const trimmedEmail = email.trim()
  
  // Check for duplicate emails (case-insensitive), excluding the current participant
  if (trimmedEmail && game.participants.some(p => 
    p.id !== participantId && p.email?.toLowerCase() === trimmedEmail.toLowerCase()
  )) {
    throw new Error('Participant email already exists')
  }

  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, email: trimmedEmail || undefined } : p
  )
  return { ...game, participants: updatedParticipants }
}

/**
 * Confirm assignment for a participant (local)
 */
export function confirmAssignmentLocal(game: Game, participantId: string): Game {
  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, hasConfirmedAssignment: true } : p
  )
  return { ...game, participants: updatedParticipants }
}

/**
 * Update game details (local)
 */
export function updateGameDetailsLocal(
  game: Game,
  details: {
    name?: string
    amount?: string
    currency?: string
    date?: string
    time?: string
    location?: string
    generalNotes?: string
    allowReassignment?: boolean
  }
): Game {
  return {
    ...game,
    name: details.name ?? game.name,
    amount: details.amount ?? game.amount,
    currency: details.currency ?? game.currency,
    date: details.date ?? game.date,
    time: details.time ?? game.time,
    location: details.location ?? game.location,
    generalNotes: details.generalNotes ?? game.generalNotes,
    allowReassignment: details.allowReassignment ?? game.allowReassignment
  }
}

/**
 * Add participant (local)
 */
export function addParticipantLocal(
  game: Game,
  name: string,
  email?: string
): Game {
  // Check for duplicate names
  if (game.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Participant name already exists')
  }

  // Check for duplicate emails (case-insensitive)
  if (email && game.participants.some(p => p.email?.toLowerCase() === email.toLowerCase())) {
    throw new Error('Participant email already exists')
  }

  const newParticipant: Participant = {
    id: generateId(),
    name: name.trim(),
    email: email?.trim() || undefined,
    desiredGift: '',
    wish: '',
    hasPendingReassignmentRequest: false,
    hasConfirmedAssignment: false,
    token: game.isProtected ? generateToken() : undefined
  }

  // Generate new assignments including the new participant
  const updatedParticipants = [...game.participants, newParticipant]
  const newAssignments = generateAssignments(updatedParticipants)

  return {
    ...game,
    participants: updatedParticipants,
    assignments: newAssignments,
    // Clear all confirmation status since assignments changed
    reassignmentRequests: []
  }
}

/**
 * Remove participant (local)
 */
export function removeParticipantLocal(game: Game, participantId: string): Game {
  if (game.participants.length <= 3) {
    throw new Error('Cannot remove participant: minimum 3 participants required')
  }

  const updatedParticipants = game.participants.filter(p => p.id !== participantId)
  
  // Generate new assignments without the removed participant
  const newAssignments = generateAssignments(updatedParticipants)

  // Remove any reassignment requests from the removed participant
  const updatedRequests = (game.reassignmentRequests || []).filter(
    r => r.participantId !== participantId
  )

  return {
    ...game,
    participants: updatedParticipants,
    assignments: newAssignments,
    reassignmentRequests: updatedRequests
  }
}

/**
 * Approve reassignment for a participant (local)
 */
export function approveReassignmentLocal(game: Game, participantId: string): Game {
  const participant = game.participants.find(p => p.id === participantId)
  if (!participant) throw new Error('Participant not found')

  // Find current assignment for this participant
  const currentAssignment = game.assignments.find(a => a.giverId === participantId)
  if (!currentAssignment) throw new Error('Assignment not found')

  // Find a valid swap partner
  const swapPartner = findValidSwapPartner(game, participantId)
  if (!swapPartner) {
    throw new Error('No valid swap available')
  }

  // Perform the swap
  const newAssignments = performSwap(game.assignments, participantId, swapPartner.id)

  // Update participant state
  const updatedParticipants = game.participants.map(p => {
    if (p.id === participantId) {
      return { ...p, hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
    }
    if (p.id === swapPartner.id) {
      return { ...p, hasConfirmedAssignment: false }
    }
    return p
  })

  // Remove the reassignment request
  const updatedRequests = (game.reassignmentRequests || []).filter(
    r => r.participantId !== participantId
  )

  return {
    ...game,
    participants: updatedParticipants,
    assignments: newAssignments,
    reassignmentRequests: updatedRequests
  }
}

/**
 * Cancel reassignment request (local)
 */
export function cancelReassignmentRequestLocal(game: Game, participantId: string): Game {
  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, hasPendingReassignmentRequest: false } : p
  )

  const updatedRequests = (game.reassignmentRequests || []).filter(
    r => r.participantId !== participantId
  )

  return {
    ...game,
    participants: updatedParticipants,
    reassignmentRequests: updatedRequests
  }
}

/**
 * Force reassignment of a specific participant (local)
 * Used by organizer to manually reassign a confirmed participant
 */
export function forceReassignParticipantLocal(game: Game, participantId: string): Game {
  const participant = game.participants.find(p => p.id === participantId)
  if (!participant) throw new Error('Participant not found')

  // Find current assignment for this participant
  const currentAssignment = game.assignments.find(a => a.giverId === participantId)
  if (!currentAssignment) throw new Error('Assignment not found')

  // Find a valid swap partner
  const swapPartner = findValidSwapPartner(game, participantId)
  if (!swapPartner) {
    throw new Error('No valid swap available')
  }

  // Perform the swap
  const newAssignments = performSwap(game.assignments, participantId, swapPartner.id)

  // Update participant state - clear confirmation since assignment changed
  const updatedParticipants = game.participants.map(p => {
    if (p.id === participantId) {
      return { ...p, hasConfirmedAssignment: false }
    }
    if (p.id === swapPartner.id) {
      return { ...p, hasConfirmedAssignment: false }
    }
    return p
  })

  return {
    ...game,
    participants: updatedParticipants,
    assignments: newAssignments
  }
}

/**
 * Approve all pending reassignments (local)
 */
export function approveAllReassignmentsLocal(game: Game): Game {
  let currentGame = { ...game }
  const pendingRequests = [...(game.reassignmentRequests || [])]

  for (const request of pendingRequests) {
    try {
      currentGame = approveReassignmentLocal(currentGame, request.participantId)
    } catch {
      // If a single approval fails, skip it and continue
      // This might happen if there's no valid swap available
    }
  }

  return currentGame
}

/**
 * Reassign all participants (local)
 * This preserves confirmed participants' assignments
 */
export function reassignAllLocal(game: Game): Game {
  // Separate confirmed and unconfirmed participants
  const confirmedParticipants = game.participants.filter(p => p.hasConfirmedAssignment)
  const unconfirmedParticipants = game.participants.filter(p => !p.hasConfirmedAssignment)

  // If all confirmed or all unconfirmed, regenerate all
  if (confirmedParticipants.length === 0 || confirmedParticipants.length === game.participants.length) {
    const newAssignments = generateAssignments(game.participants)
    const updatedParticipants = game.participants.map(p => ({
      ...p,
      hasPendingReassignmentRequest: false,
      hasConfirmedAssignment: confirmedParticipants.length === game.participants.length ? p.hasConfirmedAssignment : false
    }))
    return {
      ...game,
      participants: updatedParticipants,
      assignments: newAssignments,
      reassignmentRequests: []
    }
  }

  // Get locked assignments from confirmed participants
  const lockedAssignments = game.assignments.filter(a => 
    confirmedParticipants.some(p => p.id === a.giverId)
  )

  const lockedReceivers = new Set(lockedAssignments.map(a => a.receiverId))

  // Get available receivers for unconfirmed participants
  const availableReceivers = game.participants
    .filter(p => !lockedReceivers.has(p.id))
    .map(p => p.id)

  // Shuffle unconfirmed participants and available receivers
  const shuffledUnconfirmed = [...unconfirmedParticipants].sort(() => Math.random() - 0.5)
  const shuffledReceivers = [...availableReceivers].sort(() => Math.random() - 0.5)

  // Create new assignments, avoiding self-assignment
  const newAssignments: Assignment[] = [...lockedAssignments]

  // Try to assign receivers to givers, avoiding self-assignment
  let assignmentAttempts = 0
  const maxAttempts = 100
  
  while (assignmentAttempts < maxAttempts) {
    const tempAssignments: Assignment[] = []
    let hasError = false
    
    for (let i = 0; i < shuffledUnconfirmed.length; i++) {
      const giver = shuffledUnconfirmed[i]
      const receiver = shuffledReceivers[i]
      
      // Check for self-assignment
      if (giver.id === receiver) {
        hasError = true
        break
      }
      
      tempAssignments.push({
        giverId: giver.id,
        receiverId: receiver
      })
    }
    
    if (!hasError) {
      newAssignments.push(...tempAssignments)
      break
    }
    
    // Shuffle receivers again and retry
    shuffledReceivers.sort(() => Math.random() - 0.5)
    assignmentAttempts++
  }
  
  // If we couldn't avoid self-assignment after many attempts, fall back to full regeneration
  if (assignmentAttempts >= maxAttempts) {
    return {
      ...game,
      participants: game.participants.map(p => ({
        ...p,
        hasPendingReassignmentRequest: false,
        hasConfirmedAssignment: false
      })),
      assignments: generateAssignments(game.participants),
      reassignmentRequests: []
    }
  }

  // Update participants: clear pending requests, keep confirmation status
  const updatedParticipants = game.participants.map(p => ({
    ...p,
    hasPendingReassignmentRequest: false
    // hasConfirmedAssignment stays as is
  }))

  return {
    ...game,
    participants: updatedParticipants,
    assignments: newAssignments,
    reassignmentRequests: []
  }
}

/**
 * Update participant details (local)
 */
export function updateParticipantDetailsLocal(
  game: Game,
  participantId: string,
  details: {
    name?: string
    email?: string
    desiredGift?: string
    wish?: string
    hasConfirmedAssignment?: boolean
  }
): Game {
  // Check for duplicate emails (case-insensitive), excluding the current participant
  if (details.email && game.participants.some(p => 
    p.id !== participantId && p.email?.toLowerCase() === details.email?.toLowerCase()
  )) {
    throw new Error('Participant email already exists')
  }

  const updatedParticipants = game.participants.map(p => {
    if (p.id !== participantId) return p
    return {
      ...p,
      name: details.name ?? p.name,
      email: details.email !== undefined ? (details.email || undefined) : p.email,
      desiredGift: details.desiredGift ?? p.desiredGift,
      wish: details.wish ?? p.wish,
      hasConfirmedAssignment: details.hasConfirmedAssignment ?? p.hasConfirmedAssignment
    }
  })

  return { ...game, participants: updatedParticipants }
}

/**
 * Regenerate participant token (local)
 */
export function regenerateParticipantTokenLocal(game: Game, participantId: string): Game {
  const updatedParticipants = game.participants.map(p =>
    p.id === participantId ? { ...p, token: generateToken() } : p
  )
  return { ...game, participants: updatedParticipants }
}

// Helper: Generate assignments using circular shuffle
function generateAssignments(participants: Participant[]): Assignment[] {
  if (participants.length < 2) return []

  // Shuffle participants
  const shuffled = [...participants].sort(() => Math.random() - 0.5)

  // Create circular assignments
  const assignments: Assignment[] = []
  for (let i = 0; i < shuffled.length; i++) {
    const giver = shuffled[i]
    const receiver = shuffled[(i + 1) % shuffled.length]
    assignments.push({
      giverId: giver.id,
      receiverId: receiver.id
    })
  }

  return assignments
}

// Helper: Find a valid swap partner for reassignment
function findValidSwapPartner(game: Game, participantId: string): Participant | null {
  const currentAssignment = game.assignments.find(a => a.giverId === participantId)
  if (!currentAssignment) return null

  // Find participants who are not the current giver and not already their receiver
  const eligiblePartners = game.participants.filter(p => {
    if (p.id === participantId) return false // Can't swap with self
    
    const theirAssignment = game.assignments.find(a => a.giverId === p.id)
    if (!theirAssignment) return false

    // Check that after swap neither person would give to themselves
    // Current participant would give to theirAssignment.receiverId
    // Partner would give to currentAssignment.receiverId
    if (theirAssignment.receiverId === participantId) return false
    if (currentAssignment.receiverId === p.id) return false

    return true
  })

  if (eligiblePartners.length === 0) return null

  // Return a random eligible partner
  return eligiblePartners[Math.floor(Math.random() * eligiblePartners.length)]
}

// Helper: Perform assignment swap between two participants
function performSwap(assignments: Assignment[], participant1Id: string, participant2Id: string): Assignment[] {
  const assignment1 = assignments.find(a => a.giverId === participant1Id)
  const assignment2 = assignments.find(a => a.giverId === participant2Id)

  if (!assignment1 || !assignment2) return assignments

  // Swap receivers
  return assignments.map(a => {
    if (a.giverId === participant1Id) {
      return { ...a, receiverId: assignment2.receiverId }
    }
    if (a.giverId === participant2Id) {
      return { ...a, receiverId: assignment1.receiverId }
    }
    return a
  })
}

/**
 * Join game via invitation (local)
 */
export function joinInvitationLocal(
  game: Game,
  invitationToken: string,
  participantName: string,
  participantEmail?: string,
  desiredGift?: string,
  wish?: string
): { game: Game; participantId: string } {
  // Validate invitation token
  if (!game.invitationToken || game.invitationToken !== invitationToken) {
    throw new Error('Invalid invitation token')
  }

  const trimmedName = participantName.trim()
  const trimmedEmail = participantEmail?.trim()

  // Check for duplicate names (case-insensitive)
  if (game.participants.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Participant name already exists')
  }

  // Check for duplicate emails if email is provided (case-insensitive)
  if (trimmedEmail && game.participants.some(p => 
    p.email && p.email.toLowerCase() === trimmedEmail.toLowerCase()
  )) {
    throw new Error('Email address already in use')
  }

  // Create new participant
  const newParticipant: Participant = {
    id: generateId(),
    name: trimmedName,
    email: trimmedEmail || undefined,
    desiredGift: desiredGift?.trim() || '',
    wish: wish?.trim() || '',
    hasConfirmedAssignment: false,
    hasPendingReassignmentRequest: false,
    token: game.isProtected ? generateToken() : undefined
  }

  // Add participant to game
  const updatedParticipants = [...game.participants, newParticipant]

  // Regenerate assignments to include new participant
  const newAssignments = generateAssignments(updatedParticipants)

  // Clear any pending reassignment requests since we're regenerating all assignments
  const updatedGame = {
    ...game,
    participants: updatedParticipants.map(p => ({
      ...p,
      hasPendingReassignmentRequest: false,
      hasConfirmedAssignment: false // Clear confirmations when regenerating
    })),
    assignments: newAssignments,
    reassignmentRequests: []
  }

  return { game: updatedGame, participantId: newParticipant.id }
}
