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
 * Generate new assignments while preserving confirmed participants' assignments.
 * Confirmed participants have "locked" assignments that won't change.
 * 
 * @param participants - List of all participants
 * @param currentAssignments - Current assignments (some may be locked)
 * @returns New assignments with locked assignments preserved
 */
export function generateAssignmentsWithLocks(
  participants: Participant[],
  currentAssignments: Assignment[]
): Assignment[] {
  if (participants.length < 3) {
    throw new Error('Need at least 3 participants')
  }

  // Identify locked assignments (from confirmed participants)
  const lockedAssignments = currentAssignments.filter(assignment => {
    const giver = participants.find(p => p.id === assignment.giverId)
    return giver?.hasConfirmedAssignment === true
  })

  // If all participants are confirmed, return current assignments unchanged
  if (lockedAssignments.length === participants.length) {
    return [...currentAssignments]
  }

  // If no locked assignments, generate fresh assignments
  if (lockedAssignments.length === 0) {
    return generateAssignments(participants)
  }

  // Build maps for quick lookup
  const lockedGivers = new Set(lockedAssignments.map(a => a.giverId))
  const lockedReceivers = new Set(lockedAssignments.map(a => a.receiverId))
  
  // Participants who need new assignments
  const unlockedParticipants = participants.filter(p => !lockedGivers.has(p.id))
  
  // Receivers available for unlocked participants (excluding those locked as receivers)
  const availableReceivers = participants
    .filter(p => !lockedReceivers.has(p.id))
    .map(p => p.id)

  // Validate we have enough available receivers for unlocked participants
  if (availableReceivers.length < unlockedParticipants.length) {
    // Edge case: not enough available receivers - fall back to full regeneration
    return generateAssignments(participants)
  }

  // Shuffle unlocked participants and available receivers
  const shuffledUnlocked = [...unlockedParticipants].sort(() => Math.random() - 0.5)
  const shuffledReceivers = [...availableReceivers].sort(() => Math.random() - 0.5)

  // Create new assignments for unlocked participants
  const newAssignments: Assignment[] = [...lockedAssignments]
  
  for (let i = 0; i < shuffledUnlocked.length; i++) {
    const giver = shuffledUnlocked[i]
    const receiver = shuffledReceivers[i]
    
    // Ensure giver doesn't give to themselves
    if (giver.id === receiver) {
      // Swap with next receiver if possible
      const nextIdx = (i + 1) % shuffledReceivers.length
      if (shuffledUnlocked[nextIdx]?.id !== shuffledReceivers[nextIdx]) {
        // Swap receivers
        const temp = shuffledReceivers[i]
        shuffledReceivers[i] = shuffledReceivers[nextIdx]
        shuffledReceivers[nextIdx] = temp
      }
    }
    
    newAssignments.push({
      giverId: giver.id,
      receiverId: shuffledReceivers[i]
    })
  }

  return newAssignments
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

/**
 * Validation result for date validation.
 * When valid is true, year/month/day are always present.
 * When valid is false, error message is always present.
 */
export type DateValidationResult =
  | { valid: true; year: number; month: number; day: number }
  | { valid: false; error: string }

/**
 * Validates a date string in YYYY-MM-DD format
 * Checks format, range, and calendar validity (e.g., rejects Feb 31, April 31)
 * This validation is shared to ensure consistency across the API
 * 
 * Note: Frontend has similar validation in src/lib/game-utils.ts isValidDate() and formatDate()
 * Keep these implementations synchronized when making changes
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Validation result with parsed components if valid
 */
export function validateDateString(dateString: string): DateValidationResult {
  // Validate strict YYYY-MM-DD format (4-digit year, 2-digit month, 2-digit day)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return {
      valid: false,
      error: 'Invalid date format. Expected YYYY-MM-DD'
    }
  }
  
  // Parse date components
  const dateParts = dateString.split('-')
  const year = parseInt(dateParts[0], 10)
  const month = parseInt(dateParts[1], 10)
  const day = parseInt(dateParts[2], 10)
  
  // Validate reasonable ranges for date components
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      valid: false,
      error: 'Invalid date values. Year must be 1900-2100, month 1-12, day 1-31'
    }
  }
  
  // Create date in local timezone
  const eventDate = new Date(year, month - 1, day)
  
  // Reject if date was normalized (e.g., Feb 31 -> Mar 3, April 31 -> May 1)
  if (
    eventDate.getFullYear() !== year ||
    eventDate.getMonth() !== month - 1 ||
    eventDate.getDate() !== day
  ) {
    return {
      valid: false,
      error: 'Invalid calendar date. The date does not exist (e.g., February 31, April 31).'
    }
  }
  
  return {
    valid: true,
    year,
    month,
    day
  }
}
