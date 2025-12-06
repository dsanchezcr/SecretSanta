import { HttpRequest, InvocationContext } from '@azure/functions'
import { updateGameHandler } from '../functions/updateGame'
import { Game } from '../shared/types'

// Mock the modules
jest.mock('../shared/cosmosdb', () => ({
  getGameByCode: jest.fn(),
  updateGame: jest.fn(),
  getDatabaseStatus: jest.fn()
}))

jest.mock('../shared/game-utils', () => ({
  reassignParticipant: jest.fn(),
  generateAssignments: jest.fn(),
  generateId: jest.fn().mockReturnValue('new-participant-id')
}))

import { getGameByCode, updateGame, getDatabaseStatus } from '../shared/cosmosdb'
import { reassignParticipant, generateAssignments, generateId } from '../shared/game-utils'

const mockGetGameByCode = getGameByCode as jest.Mock
const mockUpdateGame = updateGame as jest.Mock
const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock
const mockReassignParticipant = reassignParticipant as jest.Mock
const mockGenerateAssignments = generateAssignments as jest.Mock
const mockGenerateId = generateId as jest.Mock

describe('updateGame function', () => {
  let mockContext: InvocationContext

  const createTestGame = (): Game => ({
    id: 'game-1',
    code: '123456',
    name: 'Test Game',
    amount: '20',
    currency: 'USD',
    date: '2025-12-25',
    location: 'Office',
    allowReassignment: true,
    isProtected: false,
    generalNotes: 'Test notes',
    participants: [
      { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false },
      { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false },
      { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false }
    ],
    assignments: [
      { giverId: 'p1', receiverId: 'p2' },
      { giverId: 'p2', receiverId: 'p3' },
      { giverId: 'p3', receiverId: 'p1' }
    ],
    reassignmentRequests: [],
    organizerToken: 'token-123',
    createdAt: Date.now()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext

    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockUpdateGame.mockImplementation((game) => Promise.resolve(game))
    mockGenerateId.mockReturnValue('new-participant-id')
  })

  const createMockRequest = (code: string, body: any): HttpRequest => ({
    method: 'PATCH',
    url: `http://localhost/api/games/${code}`,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    query: new URLSearchParams(),
    params: { code },
    json: jest.fn().mockResolvedValue(body)
  } as unknown as HttpRequest)

  describe('database checks', () => {
    it('should return 400 when code is missing', async () => {
      const mockRequest = {
        method: 'PATCH',
        url: 'http://localhost/api/games/',
        headers: new Headers(),
        query: new URLSearchParams(),
        params: {},
        json: jest.fn().mockResolvedValue({})
      } as unknown as HttpRequest

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Game code is required' })
    })

    it('should return 503 when database is not connected', async () => {
      mockGetDatabaseStatus.mockReturnValue({
        connected: false,
        error: 'Connection failed'
      })

      const mockRequest = createMockRequest('123456', { action: 'requestReassignment', participantId: 'p1' })
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(503)
      expect(response.jsonBody).toEqual({
        error: 'Database not available',
        details: 'Connection failed'
      })
    })

    it('should return 404 when game not found', async () => {
      mockGetGameByCode.mockResolvedValueOnce(null)

      const mockRequest = createMockRequest('999999', { action: 'requestReassignment', participantId: 'p1' })
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Game not found' })
    })
  })



  describe('requestReassignment action', () => {
    it('should add reassignment request successfully', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.hasPendingReassignmentRequest).toBe(true)
      expect(updatedGame.reassignmentRequests).toHaveLength(1)
      expect(updatedGame.reassignmentRequests[0].participantId).toBe('p1')
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'nonexistent'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should return 400 when already has pending request', async () => {
      const testGame = createTestGame()
      testGame.participants[0].hasPendingReassignmentRequest = true
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Reassignment already requested' })
    })

    it('should return 400 when reassignment not allowed', async () => {
      const testGame = createTestGame()
      testGame.allowReassignment = false
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Reassignment not allowed for this game' })
    })
  })

  describe('updateGameDetails action (organizer)', () => {
    it('should update game details with valid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateGameDetails',
        organizerToken: 'token-123',
        name: 'Updated Game Name',
        amount: '50',
        currency: 'EUR'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.name).toBe('Updated Game Name')
      expect(updatedGame.amount).toBe('50')
      expect(updatedGame.currency).toBe('EUR')
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateGameDetails',
        organizerToken: 'wrong-token',
        name: 'Updated Name'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 403 with missing token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateGameDetails',
        name: 'Updated Name'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should update all optional fields', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateGameDetails',
        organizerToken: 'token-123',
        name: 'New Name',
        amount: '100',
        currency: 'CRC',
        date: '2025-12-31',
        location: 'New Location',
        generalNotes: 'New notes',
        allowReassignment: false
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.name).toBe('New Name')
      expect(updatedGame.amount).toBe('100')
      expect(updatedGame.currency).toBe('CRC')
      expect(updatedGame.date).toBe('2025-12-31')
      expect(updatedGame.location).toBe('New Location')
      expect(updatedGame.generalNotes).toBe('New notes')
      expect(updatedGame.allowReassignment).toBe(false)
    })

    it('should preserve unchanged fields when updating only some', async () => {
      const testGame = createTestGame()
      const originalDate = testGame.date
      const originalLocation = testGame.location
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateGameDetails',
        organizerToken: 'token-123',
        name: 'Only Name Changed'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.name).toBe('Only Name Changed')
      // Original values should be preserved
      expect(updatedGame.date).toBe(originalDate)
      expect(updatedGame.location).toBe(originalLocation)
      expect(updatedGame.amount).toBe('20')
      expect(updatedGame.currency).toBe('USD')
    })
  })

  describe('addParticipant action (organizer)', () => {
    it('should add participant with valid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockGenerateAssignments.mockReturnValueOnce([
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ])

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Diana'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toHaveLength(4)
      expect(updatedGame.participants.some(p => p.name === 'Diana')).toBe(true)
    })

    it('should return 400 with missing participant name', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: ''
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name is required' })
    })

    it('should return 400 with whitespace-only participant name', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: '   '
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name is required' })
    })

    it('should return 400 when adding duplicate participant name', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Alice'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name already exists' })
    })

    it('should be case-insensitive for duplicate check', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'ALICE'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name already exists' })
    })

    it('should not regenerate assignments when less than 3 participants after adding', async () => {
      const testGame = createTestGame()
      testGame.participants = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false }
      ]
      testGame.assignments = []
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Bob'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toHaveLength(2)
      expect(updatedGame.assignments).toHaveLength(0)
      expect(mockGenerateAssignments).not.toHaveBeenCalled()
    })

    it('should regenerate assignments when reaching 3 participants', async () => {
      const testGame = createTestGame()
      testGame.participants = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false }
      ]
      testGame.assignments = []
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockGenerateAssignments.mockReturnValueOnce([
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ])

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Charlie'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toHaveLength(3)
      expect(mockGenerateAssignments).toHaveBeenCalled()
      expect(updatedGame.assignments).toHaveLength(3)
    })
  })

  describe('removeParticipant action (organizer)', () => {
    it('should remove participant with valid token', async () => {
      const testGame = createTestGame()
      // Add a 4th participant so we still have 3 after removal
      testGame.participants.push({
        id: 'p4', name: 'Diana', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false
      })
      testGame.assignments.push({ giverId: 'p4', receiverId: 'p1' })
      
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockGenerateAssignments.mockReturnValueOnce([
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'p1' }
      ])

      const mockRequest = createMockRequest('123456', {
        action: 'removeParticipant',
        organizerToken: 'token-123',
        participantId: 'p4'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toHaveLength(3)
      expect(updatedGame.participants.some(p => p.id === 'p4')).toBe(false)
    })

    it('should return 400 with missing participant ID', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'removeParticipant',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant ID is required' })
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'removeParticipant',
        organizerToken: 'token-123',
        participantId: 'nonexistent'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should clear assignments when less than 3 participants remain', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'removeParticipant',
        organizerToken: 'token-123',
        participantId: 'p3'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toHaveLength(2)
      expect(updatedGame.assignments).toHaveLength(0)
    })
  })

  describe('approveReassignment action (organizer)', () => {
    it('should approve reassignment request with valid token', async () => {
      const testGame = createTestGame()
      testGame.participants[0].hasPendingReassignmentRequest = true
      testGame.reassignmentRequests = [
        { participantId: 'p1', participantName: 'Alice', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockReassignParticipant.mockReturnValueOnce([
        { giverId: 'p1', receiverId: 'p3' },
        { giverId: 'p2', receiverId: 'p1' },
        { giverId: 'p3', receiverId: 'p2' }
      ])

      const mockRequest = createMockRequest('123456', {
        action: 'approveReassignment',
        organizerToken: 'token-123',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.hasPendingReassignmentRequest).toBe(false)
      expect(updatedGame.reassignmentRequests).toHaveLength(0)
      expect(mockReassignParticipant).toHaveBeenCalled()
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'approveReassignment',
        organizerToken: 'wrong-token',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'approveReassignment',
        organizerToken: 'token-123',
        participantId: 'nonexistent'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should return 400 when no pending request exists', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'approveReassignment',
        organizerToken: 'token-123',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'No pending reassignment request for this participant' })
    })
  })

  describe('approveAllReassignments action (organizer)', () => {
    it('should approve all pending reassignment requests with valid token', async () => {
      const testGame = createTestGame()
      testGame.participants[0].hasPendingReassignmentRequest = true
      testGame.participants[1].hasPendingReassignmentRequest = true
      testGame.reassignmentRequests = [
        { participantId: 'p1', participantName: 'Alice', requestedAt: Date.now() },
        { participantId: 'p2', participantName: 'Bob', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockReassignParticipant
        .mockReturnValueOnce([
          { giverId: 'p1', receiverId: 'p3' },
          { giverId: 'p2', receiverId: 'p1' },
          { giverId: 'p3', receiverId: 'p2' }
        ])
        .mockReturnValueOnce([
          { giverId: 'p1', receiverId: 'p3' },
          { giverId: 'p2', receiverId: 'p3' },
          { giverId: 'p3', receiverId: 'p1' }
        ])

      const mockRequest = createMockRequest('123456', {
        action: 'approveAllReassignments',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.reassignmentRequests).toHaveLength(0)
      expect(updatedGame.participants.every(p => !p.hasPendingReassignmentRequest)).toBe(true)
      expect(mockReassignParticipant).toHaveBeenCalledTimes(2)
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      testGame.reassignmentRequests = [
        { participantId: 'p1', participantName: 'Alice', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'approveAllReassignments',
        organizerToken: 'wrong-token'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 400 when no pending requests exist', async () => {
      const testGame = createTestGame()
      testGame.reassignmentRequests = []
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'approveAllReassignments',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'No pending reassignment requests' })
    })
  })

  describe('reassignAll action (organizer)', () => {
    it('should reassign all participants with valid token', async () => {
      const testGame = createTestGame()
      testGame.participants[0].hasPendingReassignmentRequest = true
      testGame.reassignmentRequests = [
        { participantId: 'p1', participantName: 'Alice', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)
      mockGenerateAssignments.mockReturnValueOnce([
        { giverId: 'p1', receiverId: 'p3' },
        { giverId: 'p2', receiverId: 'p1' },
        { giverId: 'p3', receiverId: 'p2' }
      ])

      const mockRequest = createMockRequest('123456', {
        action: 'reassignAll',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.reassignmentRequests).toHaveLength(0)
      expect(updatedGame.participants.every(p => !p.hasPendingReassignmentRequest)).toBe(true)
      expect(mockGenerateAssignments).toHaveBeenCalled()
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'reassignAll',
        organizerToken: 'wrong-token'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 400 when less than 3 participants', async () => {
      const testGame = createTestGame()
      testGame.participants = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasConfirmedAssignment: false, hasPendingReassignmentRequest: false }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'reassignAll',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Need at least 3 participants to generate assignments' })
    })
  })

  describe('cancelReassignmentRequest action (organizer)', () => {
    it('should cancel reassignment request with valid token', async () => {
      const testGame = createTestGame()
      testGame.participants[0].hasPendingReassignmentRequest = true
      testGame.reassignmentRequests = [
        { participantId: 'p1', participantName: 'Alice', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'cancelReassignmentRequest',
        organizerToken: 'token-123',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.hasPendingReassignmentRequest).toBe(false)
      expect(updatedGame.reassignmentRequests).toHaveLength(0)
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'cancelReassignmentRequest',
        organizerToken: 'wrong-token',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'cancelReassignmentRequest',
        organizerToken: 'token-123',
        participantId: 'nonexistent'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })
  })

  describe('updateWish action', () => {
    it('should update participant wish successfully', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateWish',
        participantId: 'p1',
        wish: 'I would like a book'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.wish).toBe('I would like a book')
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateWish',
        participantId: 'nonexistent',
        wish: 'Some wish'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should allow empty wish', async () => {
      const testGame = createTestGame()
      testGame.participants[0].wish = 'Old wish'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateWish',
        participantId: 'p1',
        wish: ''
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.wish).toBe('')
    })

    it('should update wish without requiring organizer token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateWish',
        participantId: 'p1',
        wish: 'My wish'
        // No organizerToken needed
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
    })

    it('should not affect other participants when updating wish', async () => {
      const testGame = createTestGame()
      testGame.participants[1].wish = 'Bob wish'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateWish',
        participantId: 'p1',
        wish: 'Alice wish'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const bob = updatedGame.participants.find(p => p.id === 'p2')
      expect(bob?.wish).toBe('Bob wish')
    })
  })

  describe('updateParticipantEmail action', () => {
    it('should update participant email successfully', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: 'alice@example.com'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.email).toBe('alice@example.com')
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'nonexistent',
        email: 'test@example.com'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should allow clearing email with empty string', async () => {
      const testGame = createTestGame()
      testGame.participants[0].email = 'old@example.com'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: ''
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.email).toBeUndefined()
    })

    it('should trim whitespace from email', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: '  alice@example.com  '
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.email).toBe('alice@example.com')
    })

    it('should update email without requiring organizer token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: 'alice@example.com'
        // No organizerToken needed
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
    })

    it('should not affect other participants when updating email', async () => {
      const testGame = createTestGame()
      testGame.participants[1].email = 'bob@example.com'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: 'alice@example.com'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const bob = updatedGame.participants.find(p => p.id === 'p2')
      expect(bob?.email).toBe('bob@example.com')
    })
  })

  describe('addParticipant with email', () => {
    it('should add participant with email when provided', async () => {
      const testGame = createTestGame()
      testGame.participants = [testGame.participants[0], testGame.participants[1]]
      testGame.assignments = []
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Dave',
        participantEmail: 'dave@example.com'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const newParticipant = updatedGame.participants.find(p => p.name === 'Dave')
      expect(newParticipant?.email).toBe('dave@example.com')
    })

    it('should add participant without email when not provided', async () => {
      const testGame = createTestGame()
      testGame.participants = [testGame.participants[0], testGame.participants[1]]
      testGame.assignments = []
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'Dave'
        // No participantEmail
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const newParticipant = updatedGame.participants.find(p => p.name === 'Dave')
      expect(newParticipant?.email).toBeUndefined()
    })
  })

  describe('updateParticipantDetails action (organizer)', () => {
    it('should update participant details with valid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        name: 'Alice Updated',
        email: 'alice.updated@example.com',
        desiredGift: 'Book',
        wish: 'I love reading!'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.name).toBe('Alice Updated')
      expect(participant?.email).toBe('alice.updated@example.com')
      expect(participant?.desiredGift).toBe('Book')
      expect(participant?.wish).toBe('I love reading!')
    })

    it('should return 403 with invalid token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'wrong-token',
        participantId: 'p1',
        name: 'Alice Updated'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 400 when participant ID is missing', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        name: 'Alice Updated'
        // Missing participantId
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant ID is required' })
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'nonexistent',
        name: 'Alice Updated'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should return 400 when name is empty', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        name: '   '
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name cannot be empty' })
    })

    it('should return 400 when name already exists', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        name: 'Bob' // Bob is p2
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name already exists' })
    })

    it('should allow keeping the same name', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        name: 'Alice' // Same name as current
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.name).toBe('Alice')
    })

    it('should clear email when empty string is provided', async () => {
      const testGame = createTestGame()
      testGame.participants[0].email = 'alice@example.com'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        email: ''
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.email).toBeUndefined()
    })

    it('should update only provided fields', async () => {
      const testGame = createTestGame()
      testGame.participants[0].wish = 'Original wish'
      testGame.participants[0].desiredGift = 'Original gift'
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'updateParticipantDetails',
        organizerToken: 'token-123',
        participantId: 'p1',
        name: 'Alice Updated'
        // Only updating name, not wish or desiredGift
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      const participant = updatedGame.participants.find(p => p.id === 'p1')
      expect(participant?.name).toBe('Alice Updated')
      expect(participant?.wish).toBe('Original wish')
      expect(participant?.desiredGift).toBe('Original gift')
    })
  })

  describe('regenerateToken action (organizer)', () => {
    it('should regenerate participant token with valid organizer token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'regenerateToken',
        organizerToken: 'token-123',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const updatedGame = response.jsonBody as Game
      expect(updatedGame.participants).toBeDefined()
      // Verify the game was updated with new token
      expect(mockUpdateGame).toHaveBeenCalled()
    })

    it('should return 403 with invalid organizer token', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'regenerateToken',
        organizerToken: 'wrong-token',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid organizer token' })
    })

    it('should return 404 when participant not found', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'regenerateToken',
        organizerToken: 'token-123',
        participantId: 'nonexistent'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(404)
      expect(response.jsonBody).toEqual({ error: 'Participant not found' })
    })

    it('should return 400 with missing participant ID', async () => {
      const testGame = createTestGame()
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', {
        action: 'regenerateToken',
        organizerToken: 'token-123'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant ID is required' })
    })
  })

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      mockGetGameByCode.mockRejectedValueOnce(new Error('Database error'))

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'p1'
      })
      
      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(500)
      expect(response.jsonBody).toEqual({
        error: 'Failed to update game',
        details: 'Database error'
      })
    })

    it('should log errors', async () => {
      mockGetGameByCode.mockRejectedValueOnce(new Error('Database error'))

      const mockRequest = createMockRequest('123456', {
        action: 'requestReassignment',
        participantId: 'p1'
      })
      
      await updateGameHandler(mockRequest, mockContext)

      expect(mockContext.error).toHaveBeenCalled()
    })
  })

  describe('joinInvitation action', () => {
    it('should successfully add a new participant via invitation', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      mockGetGameByCode.mockResolvedValue(game)
      
      const newAssignments = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ]
      mockGenerateAssignments.mockReturnValue(newAssignments)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'David',
        participantEmail: 'david@email.com',
        desiredGift: 'Book',
        wish: 'Science fiction book',
        language: 'en'
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      expect(mockUpdateGame).toHaveBeenCalled()
      
      const updatedGame = mockUpdateGame.mock.calls[0][0]
      expect(updatedGame.participants).toHaveLength(4)
      expect(updatedGame.participants[3].name).toBe('David')
      expect(updatedGame.participants[3].email).toBe('david@email.com')
      expect(updatedGame.participants[3].desiredGift).toBe('Book')
      expect(updatedGame.participants[3].wish).toBe('Science fiction book')
      expect(updatedGame.assignments).toEqual(newAssignments)
      expect(updatedGame.reassignmentRequests).toEqual([])
    })

    it('should reject invalid invitation token', async () => {
      const game = createTestGame()
      game.invitationToken = 'valid-token-123'
      mockGetGameByCode.mockResolvedValue(game)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invalid-token',
        participantName: 'David'
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid invitation token' })
    })

    it('should reject empty participant name', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      mockGetGameByCode.mockResolvedValue(game)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: '   '
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name is required' })
    })

    it('should reject duplicate participant name', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      mockGetGameByCode.mockResolvedValue(game)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'Alice' // Already exists
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Participant name already exists' })
    })

    it('should reject duplicate email address', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      game.participants[0].email = 'alice@email.com'
      mockGetGameByCode.mockResolvedValue(game)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'David',
        participantEmail: 'alice@email.com' // Already exists
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(400)
      expect(response.jsonBody).toEqual({ error: 'Email address already in use' })
    })

    it('should clear confirmation states when regenerating assignments', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      game.participants[0].hasConfirmedAssignment = true
      game.participants[1].hasPendingReassignmentRequest = true
      game.reassignmentRequests = [
        { participantId: 'p2', participantName: 'Bob', requestedAt: Date.now() }
      ]
      mockGetGameByCode.mockResolvedValue(game)
      
      const newAssignments = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ]
      mockGenerateAssignments.mockReturnValue(newAssignments)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'David'
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      
      const updatedGame = mockUpdateGame.mock.calls[0][0]
      // All participants should have cleared states
      updatedGame.participants.forEach((p: { hasConfirmedAssignment: boolean; hasPendingReassignmentRequest: boolean }) => {
        expect(p.hasConfirmedAssignment).toBe(false)
        expect(p.hasPendingReassignmentRequest).toBe(false)
      })
      expect(updatedGame.reassignmentRequests).toEqual([])
    })

    it('should create participant with token for protected games', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      game.isProtected = true
      mockGetGameByCode.mockResolvedValue(game)
      mockGenerateId.mockReturnValueOnce('new-participant-id').mockReturnValueOnce('new-token-456')
      
      const newAssignments = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ]
      mockGenerateAssignments.mockReturnValue(newAssignments)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'David'
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      
      const updatedGame = mockUpdateGame.mock.calls[0][0]
      expect(updatedGame.participants[3].token).toBe('new-token-456')
    })

    it('should handle optional fields correctly', async () => {
      const game = createTestGame()
      game.invitationToken = 'invitation-token-123'
      mockGetGameByCode.mockResolvedValue(game)
      
      const newAssignments = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'new-participant-id' },
        { giverId: 'new-participant-id', receiverId: 'p1' }
      ]
      mockGenerateAssignments.mockReturnValue(newAssignments)

      const mockRequest = createMockRequest(game.code, {
        action: 'joinInvitation',
        invitationToken: 'invitation-token-123',
        participantName: 'David'
        // No email, desiredGift, or wish
      })

      const response = await updateGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      
      const updatedGame = mockUpdateGame.mock.calls[0][0]
      expect(updatedGame.participants[3].email).toBeUndefined()
      expect(updatedGame.participants[3].desiredGift).toBe('')
      expect(updatedGame.participants[3].wish).toBe('')
    })
  })
})
