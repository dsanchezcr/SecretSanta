import { sendEmailHandler } from '../functions/sendEmail'
import { HttpRequest, InvocationContext } from '@azure/functions'
import * as cosmosdb from '../shared/cosmosdb'
import * as emailService from '../shared/email-service'

// Mock the modules
jest.mock('../shared/cosmosdb')
jest.mock('../shared/email-service')
jest.mock('../shared/game-utils', () => ({
  safeCompare: jest.fn().mockImplementation((a: string, b: string) => a === b)
}))
jest.mock('../shared/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(null)
}))
jest.mock('@azure/communication-email', () => ({
  EmailClient: jest.fn(),
  KnownEmailSendStatus: {
    Succeeded: 'Succeeded',
    Failed: 'Failed',
    Running: 'Running'
  }
}))

const mockCosmosdb = cosmosdb as jest.Mocked<typeof cosmosdb>
const mockEmailService = emailService as jest.Mocked<typeof emailService>

describe('sendEmail function', () => {
  let mockContext: InvocationContext

  beforeEach(() => {
    jest.clearAllMocks()
    mockContext = {
      log: jest.fn(),
      error: jest.fn()
    } as unknown as InvocationContext
  })

  const createMockRequest = (body: object): HttpRequest => ({
    method: 'POST',
    url: 'http://localhost/api/email/send',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    query: new URLSearchParams(),
    params: {},
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    body: null,
    bodyUsed: false,
    clone: jest.fn(),
    user: null
  } as unknown as HttpRequest)

  it('should return 503 if email service is not configured', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: false,
      error: 'ACS_CONNECTION_STRING not configured'
    })

    const request = createMockRequest({ code: '123456', type: 'organizer' })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(503)
    expect(response.jsonBody).toHaveProperty('error', 'Email service not configured')
  })

  it('should return 503 if database is not connected', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: false,
      error: 'Database connection failed'
    })

    const request = createMockRequest({ code: '123456', type: 'organizer' })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(503)
    expect(response.jsonBody).toHaveProperty('error', 'Database not available')
  })

  it('should return 400 if game code is missing', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    const request = createMockRequest({ type: 'organizer' })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(400)
    expect(response.jsonBody).toHaveProperty('error', 'Game code is required')
  })

  it('should return 400 if type is invalid', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })

    const request = createMockRequest({ code: '123456', type: 'invalid' })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(400)
    expect(response.jsonBody).toHaveProperty('error')
  })

  it('should return 404 if game is not found', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })
    mockCosmosdb.getGameByCode.mockResolvedValue(null)

    const request = createMockRequest({ code: '123456', type: 'organizer', organizerToken: 'token' })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(404)
    expect(response.jsonBody).toHaveProperty('error', 'Game not found')
  })

  it('should return 403 if organizer token is invalid', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })
    mockCosmosdb.getGameByCode.mockResolvedValue({
      id: '1',
      code: '123456',
      organizerToken: 'correct-token',
      organizerEmail: 'test@test.com',
      participants: [],
      assignments: [],
      reassignmentRequests: [],
      name: 'Test Game',
      amount: '20',
      currency: 'USD',
      date: '2024-12-25',
      location: 'Test Location',
      allowReassignment: true,
      isProtected: false,
      generalNotes: '',
      createdAt: Date.now()
    })

    const request = createMockRequest({ 
      code: '123456', 
      type: 'organizer', 
      organizerToken: 'wrong-token' 
    })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(403)
    expect(response.jsonBody).toHaveProperty('error', 'Invalid organizer token')
  })

  it('should send organizer email successfully', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })
    mockCosmosdb.getGameByCode.mockResolvedValue({
      id: '1',
      code: '123456',
      organizerToken: 'correct-token',
      organizerEmail: 'organizer@test.com',
      participants: [],
      assignments: [],
      reassignmentRequests: [],
      name: 'Test Game',
      amount: '20',
      currency: 'USD',
      date: '2024-12-25',
      location: 'Test Location',
      allowReassignment: true,
      isProtected: false,
      generalNotes: '',
      createdAt: Date.now()
    })
    mockEmailService.sendOrganizerEmail.mockResolvedValue({
      success: true,
      error: undefined
    })

    const request = createMockRequest({ 
      code: '123456', 
      type: 'organizer', 
      organizerToken: 'correct-token' 
    })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toHaveProperty('success', true)
    expect(mockEmailService.sendOrganizerEmail).toHaveBeenCalled()
  })

  it('should send all participant emails successfully', async () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({
      configured: true,
      error: null
    })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({
      connected: true,
      error: null
    })
    mockCosmosdb.getGameByCode.mockResolvedValue({
      id: '1',
      code: '123456',
      organizerToken: 'correct-token',
      organizerEmail: 'organizer@test.com',
      participants: [
        { id: 'p1', name: 'Alice', email: 'alice@test.com', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p2', name: 'Bob', email: 'bob@test.com', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
      ],
      assignments: [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p1' }
      ],
      reassignmentRequests: [],
      name: 'Test Game',
      amount: '20',
      currency: 'USD',
      date: '2024-12-25',
      location: 'Test Location',
      allowReassignment: true,
      isProtected: false,
      generalNotes: '',
      createdAt: Date.now()
    })
    mockEmailService.sendAllParticipantEmails.mockResolvedValue({
      sent: 2,
      failed: 0,
      errors: []
    })

    const request = createMockRequest({ 
      code: '123456', 
      type: 'allParticipants', 
      organizerToken: 'correct-token' 
    })
    const response = await sendEmailHandler(request, mockContext)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toHaveProperty('success', true)
    expect(response.jsonBody).toHaveProperty('sent', 2)
    expect(response.jsonBody).toHaveProperty('failed', 0)
  })

  const makeBaseGameMock = (overrides = {}) => ({
    id: '1',
    code: '123456',
    organizerToken: 'correct-token',
    organizerEmail: 'organizer@test.com',
    participants: [
      { id: 'p1', name: 'Alice', email: 'alice@test.com', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
    ],
    assignments: [],
    reassignmentRequests: [],
    name: 'Test Game',
    amount: '20',
    currency: 'USD',
    date: '2024-12-25',
    location: 'Test Location',
    allowReassignment: true,
    isProtected: false,
    generalNotes: '',
    createdAt: Date.now(),
    ...overrides
  })

  const setupConfigured = () => {
    mockEmailService.getEmailServiceStatus.mockReturnValue({ configured: true, error: null })
    mockCosmosdb.getDatabaseStatus.mockReturnValue({ connected: true, error: null })
  }

  describe('customMessage validation', () => {
    it('should return 400 when customMessage exceeds max length', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({
        code: '123456',
        type: 'reminder',
        organizerToken: 'correct-token',
        participantId: 'p1',
        customMessage: 'A'.repeat(2001)
      })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toHaveProperty('error')
    })
  })

  describe('recoverOrganizerLink', () => {
    it('should return 400 when email is missing', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'recoverOrganizerLink' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toHaveProperty('error')
    })

    it('should return 400 when game has no organizerEmail', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({ organizerEmail: undefined }))

      const request = createMockRequest({ code: '123456', type: 'recoverOrganizerLink', email: 'any@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return success when email does not match (security - no reveal)', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'recoverOrganizerLink', email: 'wrong@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should send recovery email when email matches', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendOrganizerRecoveryEmail.mockResolvedValue({ success: true })

      const request = createMockRequest({ code: '123456', type: 'recoverOrganizerLink', email: 'organizer@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should return 500 when recovery email send fails', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendOrganizerRecoveryEmail.mockResolvedValue({ success: false, error: 'Send failed' })

      const request = createMockRequest({ code: '123456', type: 'recoverOrganizerLink', email: 'organizer@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(500)
    })
  })

  describe('recoverParticipantLink', () => {
    it('should return 400 when email is missing', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'recoverParticipantLink' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return success when participant email does not match (security)', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'recoverParticipantLink', email: 'unknown@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should send recovery email when participant email matches', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendParticipantRecoveryEmail.mockResolvedValue({ success: true })

      const request = createMockRequest({ code: '123456', type: 'recoverParticipantLink', email: 'alice@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should return 500 when participant recovery email send fails', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendParticipantRecoveryEmail.mockResolvedValue({ success: false, error: 'Send failed' })

      const request = createMockRequest({ code: '123456', type: 'recoverParticipantLink', email: 'alice@test.com' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(500)
    })
  })

  describe('organizer email type', () => {
    it('should return 400 when no organizerEmail for organizer type', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({ organizerEmail: undefined }))

      const request = createMockRequest({ code: '123456', type: 'organizer', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return 500 when organizer email send fails', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendOrganizerEmail.mockResolvedValue({ success: false, error: 'Send error' })

      const request = createMockRequest({ code: '123456', type: 'organizer', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(500)
    })
  })

  describe('participant email type', () => {
    it('should return 400 when participantId is missing', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'participant', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return 404 when participant not found', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'participant', organizerToken: 'correct-token', participantId: 'nonexistent' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(404)
    })

    it('should return 400 when participant has no email', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({
        participants: [{ id: 'p1', name: 'Alice', email: undefined, desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }]
      }))

      const request = createMockRequest({ code: '123456', type: 'participant', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should send participant email successfully', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendParticipantAssignmentEmail.mockResolvedValue({ success: true })

      const request = createMockRequest({ code: '123456', type: 'participant', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })
  })

  describe('reminder email type', () => {
    it('should return 400 when no participants have email for reminderAll', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({
        participants: [{ id: 'p1', name: 'Alice', email: undefined, desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }]
      }))

      const request = createMockRequest({ code: '123456', type: 'reminderAll', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should send reminderAll successfully', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendReminderToAllParticipants.mockResolvedValue({ sent: 1, failed: 0, errors: [] })

      const request = createMockRequest({ code: '123456', type: 'reminderAll', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should include errors in reminderAll response when some fail', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendReminderToAllParticipants.mockResolvedValue({ sent: 0, failed: 1, errors: ['Send failed for p1'] })

      const request = createMockRequest({ code: '123456', type: 'reminderAll', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.errors).toBeDefined()
    })

    it('should send reminder to specific participant successfully', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendReminderEmail.mockResolvedValue({ success: true })

      const request = createMockRequest({ code: '123456', type: 'reminder', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
    })

    it('should return 400 when reminder participantId is missing', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'reminder', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return 404 when reminder participant not found', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())

      const request = createMockRequest({ code: '123456', type: 'reminder', organizerToken: 'correct-token', participantId: 'nonexistent' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(404)
    })

    it('should return 400 when reminder participant has no email', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({
        participants: [{ id: 'p1', name: 'Alice', email: undefined, desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }]
      }))

      const request = createMockRequest({ code: '123456', type: 'reminder', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should return 500 when reminder email send fails', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendReminderEmail.mockResolvedValue({ success: false, error: 'Send error' })

      const request = createMockRequest({ code: '123456', type: 'reminder', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(500)
    })
  })

  describe('allParticipants', () => {
    it('should return 400 when no participants have email for allParticipants', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock({
        participants: [{ id: 'p1', name: 'Alice', email: undefined, desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }]
      }))

      const request = createMockRequest({ code: '123456', type: 'allParticipants', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(400)
    })

    it('should include errors in allParticipants response when some fail', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendAllParticipantEmails.mockResolvedValue({ sent: 0, failed: 1, errors: ['Failed for p1'] })

      const request = createMockRequest({ code: '123456', type: 'allParticipants', organizerToken: 'correct-token' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.errors).toBeDefined()
    })
  })

  describe('participant email failure', () => {
    it('should return 500 when participant email send fails', async () => {
      setupConfigured()
      mockCosmosdb.getGameByCode.mockResolvedValue(makeBaseGameMock())
      mockEmailService.sendParticipantAssignmentEmail.mockResolvedValue({ success: false, error: 'Send error' })

      const request = createMockRequest({ code: '123456', type: 'participant', organizerToken: 'correct-token', participantId: 'p1' })
      const response = await sendEmailHandler(request, mockContext)

      expect(response.status).toBe(500)
    })
  })
})
