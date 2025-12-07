import { Assignment, Participant, Language } from './types'

export function generateGameCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * Build a URL with a specific language parameter
 * @param baseUrl - The base URL path
 * @param language - Language code to include
 * @returns Full URL with language parameter
 */
export function buildUrlWithLanguage(baseUrl: string, language: Language): string {
  const url = new URL(baseUrl, window.location.origin)
  url.searchParams.set('lang', language)
  return url.toString()
}

/**
 * Get the current URL with a language parameter added/updated
 * @param language - Language code to include
 * @returns Current URL with language parameter
 */
export function getCurrentUrlWithLanguage(language: Language): string {
  const url = new URL(window.location.href)
  url.searchParams.set('lang', language)
  return url.toString()
}

/**
 * Build a URL with query parameters, optionally including language
 * @param path - The path or query params to add (e.g., '?code=123456')
 * @param language - Optional language to include in the URL
 * @returns Full URL with all parameters
 */
export function buildShareableUrl(params: {
  code?: string
  organizer?: string
  participant?: string
  lang?: Language
  view?: string
}): string {
  const url = new URL(window.location.origin)
  
  if (params.code) url.searchParams.set('code', params.code)
  if (params.organizer) url.searchParams.set('organizer', params.organizer)
  if (params.participant) url.searchParams.set('participant', params.participant)
  if (params.lang) url.searchParams.set('lang', params.lang)
  if (params.view) url.searchParams.set('view', params.view)
  
  return url.toString()
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

/**
 * Format a date string in YYYY-MM-DD format for display
 * 
 * NOTE: This function includes basic validation for display purposes only.
 * The backend performs authoritative validation in api/src/shared/game-utils.ts.
 * The frontend validation ensures consistent display behavior but does not
 * replace server-side validation for security and data integrity.
 * 
 * When updating validation rules, keep frontend and backend implementations
 * synchronized for consistent user experience.
 * 
 * The validation includes:
 * - Format check: Enforces YYYY-MM-DD with exact digit counts
 * - Calendar validation: Rejects invalid dates like Feb 31, April 31
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @param locale - Locale for formatting (default: 'es')
 * @returns Formatted date string or fallback representation
 */
export function formatDate(dateString: string, locale: string = 'es'): string {
  // Parse YYYY-MM-DD format correctly to avoid timezone issues
  // Validate format first (matches backend validation in api/src/shared/game-utils.ts)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    // Return as-is for unexpected format to preserve original value
    return dateString
  }
  
  // Split the date string and create date in local timezone
  const parts = dateString.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1  // month is 0-indexed
  const day = parseInt(parts[2], 10)
  
  // Create the date
  const date = new Date(year, month, day)
  
  // Validate the date wasn't normalized (e.g., Feb 31 -> Mar 3)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    // Invalid date - return a fallback string
    return dateString
  }
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Validates a date string in YYYY-MM-DD format (frontend validation)
 * 
 * NOTE: This function provides client-side validation for better UX.
 * The backend performs authoritative validation in api/src/shared/game-utils.ts.
 * Keep these implementations synchronized.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns true if valid, false otherwise
 */
export function isValidDate(dateString: string): boolean {
  // Validate strict YYYY-MM-DD format (4-digit year, 2-digit month, 2-digit day)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false
  }
  
  // Parse date components
  const parts = dateString.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  
  // Validate reasonable ranges for date components
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }
  
  // Create date in local timezone
  const date = new Date(year, month - 1, day)
  
  // Reject if date was normalized (e.g., Feb 31 -> Mar 3, April 31 -> May 1)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false
  }
  
  return true
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
  }
  
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  
  try {
    document.execCommand('copy')
    // Defensive check: ensure textarea is still in DOM before removing
    if (textarea.parentNode === document.body) {
      document.body.removeChild(textarea)
    }
    return Promise.resolve()
  } catch (err) {
    // Defensive check: ensure textarea is still in DOM before removing
    if (textarea.parentNode === document.body) {
      document.body.removeChild(textarea)
    }
    return Promise.reject(err)
  }
}
