export interface Participant {
  id: string
  name: string
  email?: string // Optional email for participant notifications
  desiredGift: string
  wish: string
  hasConfirmedAssignment: boolean // Participant has confirmed they received their assignment
  hasPendingReassignmentRequest: boolean
  token?: string // Unique token for protected games
}

export interface Assignment {
  giverId: string
  receiverId: string
}

export interface ReassignmentRequest {
  participantId: string
  participantName: string
  requestedAt: number
}

export interface Currency {
  code: string
  symbol: string
  name: string
  flag: string
}

export const CURRENCIES: Currency[] = [
  // Priority currencies first
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', flag: '🇨🇷' },
  // Rest alphabetically by name
  { code: 'ARS', symbol: '$', name: 'Argentine Peso', flag: '🇦🇷' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'COP', symbol: '$', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', flag: '🇬🇹' },
  { code: 'HNL', symbol: 'L', name: 'Honduran Lempira', flag: '🇭🇳' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba', flag: '🇳🇮' },
  { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa', flag: '🇵🇦' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', flag: '🇺🇾' },
  { code: 'VES', symbol: 'Bs.', name: 'Venezuelan Bolívar', flag: '🇻🇪' },
]

export interface Game {
  id: string
  code: string
  name: string
  amount: string
  currency: string
  date: string
  time?: string // Optional time for the event
  location: string
  allowReassignment: boolean
  isProtected: boolean // When true, participants need unique tokens to access the game
  generalNotes: string
  participants: Participant[]
  assignments: Assignment[]
  reassignmentRequests: ReassignmentRequest[]
  organizerToken: string
  organizerEmail?: string // Optional email for organizer notifications
  organizerLanguage?: Language // Preferred language for organizer email notifications (only stored when email service is configured)
  invitationToken?: string // Token for invitation link to allow new participants to join
  createdAt: number
}

export type Language = 'en' | 'es' | 'pt' | 'fr' | 'it' | 'ja' | 'zh' | 'de' | 'nl'

export interface LanguageOption {
  code: Language
  name: string
  nativeName: string
  flag: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
]

export interface Participant {
  id: string
  name: string
  email?: string // Optional email for participant notifications
  desiredGift: string
  wish: string
  hasConfirmedAssignment: boolean // Participant has confirmed they received their assignment
  hasPendingReassignmentRequest: boolean
  token?: string // Unique token for protected games
  preferredLanguage?: Language // Preferred language for email notifications (only stored when email service is configured)
}
