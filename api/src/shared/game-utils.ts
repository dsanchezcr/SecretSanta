import { Assignment, Participant } from './types'

export function generateGameCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

export function generateAssignments(participants: Participant[]): Assignment[] {
  if (participants.length < 3) {
    throw new Error('Need at least 3 participants')
  }

  const shuffled = [...participants].sort(() => Math.random() - 0.5)
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

/**
 * Reassign a participant to a different receiver by swapping with another giver.
 * This maintains the constraint that each participant receives exactly one gift.
 * 
 * @param participantId - The giver who wants a new assignment
 * @param currentAssignments - Current list of assignments
 * @param participants - List of all participants (used to check confirmation status)
 * @returns Updated assignments with the swap applied, or null if no valid swap is possible
 */
export function reassignParticipant(
  participantId: string,
  currentAssignments: Assignment[],
  participants: Participant[]
): Assignment[] | null {
  // Find the requesting participant's current assignment (A → B)
  const requesterAssignment = currentAssignments.find(a => a.giverId === participantId)
  if (!requesterAssignment) return currentAssignments
  
  const currentReceiverId = requesterAssignment.receiverId
  
  // Find potential swap partners:
  // - Must be a different giver
  // - Must give to someone other than the requester (to avoid A → A)
  // - Must give to someone other than current receiver (to actually change the assignment)
  // - After swap, the swap partner must not end up giving to themselves
  // - Preferably someone who hasn't confirmed their assignment yet
  const potentialSwapPartners = currentAssignments.filter(a => {
    // Not the requester themselves
    if (a.giverId === participantId) return false
    // Not giving to the requester (would create A → A after swap)
    if (a.receiverId === participantId) return false
    // Not giving to the same person (no change)
    if (a.receiverId === currentReceiverId) return false
    // After swap, partner would give to currentReceiverId - check it's not themselves
    if (a.giverId === currentReceiverId) return false
    return true
  })
  
  if (potentialSwapPartners.length === 0) {
    // No valid swap possible - need full regeneration or manual intervention
    return null
  }
  
  // Sort swap partners: prefer those who haven't confirmed their assignment
  const sortedSwapPartners = [...potentialSwapPartners].sort((a, b) => {
    const participantA = participants.find(p => p.id === a.giverId)
    const participantB = participants.find(p => p.id === b.giverId)
    const confirmedA = participantA?.hasConfirmedAssignment ? 1 : 0
    const confirmedB = participantB?.hasConfirmedAssignment ? 1 : 0
    return confirmedA - confirmedB // Unconfirmed (0) comes before confirmed (1)
  })
  
  // Pick the best swap partner (first unconfirmed, or random if all confirmed)
  const unconfirmedPartners = sortedSwapPartners.filter(a => {
    const participant = participants.find(p => p.id === a.giverId)
    return !participant?.hasConfirmedAssignment
  })
  
  const swapPartner = unconfirmedPartners.length > 0
    ? unconfirmedPartners[Math.floor(Math.random() * unconfirmedPartners.length)]
    : sortedSwapPartners[Math.floor(Math.random() * sortedSwapPartners.length)]
  
  // Perform the swap:
  // Before: A → B, C → D
  // After:  A → D, C → B
  const newReceiverForRequester = swapPartner.receiverId
  const newReceiverForPartner = currentReceiverId
  
  return currentAssignments.map(assignment => {
    if (assignment.giverId === participantId) {
      return { ...assignment, receiverId: newReceiverForRequester }
    }
    if (assignment.giverId === swapPartner.giverId) {
      return { ...assignment, receiverId: newReceiverForPartner }
    }
    return assignment
  })
}
