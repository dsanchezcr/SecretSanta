import { HttpRequest, InvocationContext } from '@azure/functions'
import { getGameHandler } from '../functions/getGame'
import { Game } from '../shared/types'

// Mock the cosmosdb module
jest.mock('../shared/cosmosdb', () => ({
  getGameByCode: jest.fn(),
  getDatabaseStatus: jest.fn()
}))

import { getGameByCode, getDatabaseStatus } from '../shared/cosmosdb'

const mockGetGameByCode = getGameByCode as jest.Mock
const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock

describe('getGame function', () => {
  let mockContext: InvocationContext

  const testGame: Game = {
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
      { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
      { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
      { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
    ],
    assignments: [
      { giverId: 'p1', receiverId: 'p2' },
      { giverId: 'p2', receiverId: 'p3' },
      { giverId: 'p3', receiverId: 'p1' }
    ],
    reassignmentRequests: [],
    organizerToken: 'token-123',
    createdAt: Date.now()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext

    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
  })

  const createMockRequest = (code?: string, query?: Record<string, string>): HttpRequest => {
    const searchParams = new URLSearchParams(query)
    return {
      method: 'GET',
      url: `http://localhost/api/games/${code || ''}`,
      headers: new Headers(),
      query: searchParams,
      params: { code }
    } as unknown as HttpRequest
  }

  it('should return game when found', async () => {
    mockGetGameByCode.mockResolvedValueOnce(testGame)

    const mockRequest = createMockRequest('123456')
    const response = await getGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(200)
    // For non-protected games, tokens should be stripped from participants
    const responseBody = response.jsonBody as any
    expect(responseBody.code).toBe('123456')
    responseBody.participants.forEach((p: any) => {
      expect(p.token).toBeUndefined()
    })
  })

  it('should return 404 when game not found', async () => {
    mockGetGameByCode.mockResolvedValueOnce(null)

    const mockRequest = createMockRequest('999999')
    const response = await getGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(404)
    expect(response.jsonBody).toEqual({ error: 'Game not found' })
  })

  it('should return 400 when code is missing', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost/api/games/',
      headers: new Headers(),
      query: new URLSearchParams(),
      params: {}
    } as unknown as HttpRequest

    const response = await getGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(400)
    expect(response.jsonBody).toEqual({ error: 'Game code is required' })
  })

  it('should return 503 when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({
      connected: false,
      error: 'Connection timeout'
    })

    const mockRequest = createMockRequest('123456')
    const response = await getGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(503)
    expect(response.jsonBody).toEqual({
      error: 'Database not available',
      details: 'Connection timeout'
    })
  })

  it('should return 500 on database error', async () => {
    mockGetGameByCode.mockRejectedValueOnce(new Error('Query failed'))

    const mockRequest = createMockRequest('123456')
    const response = await getGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(500)
    expect(response.jsonBody).toEqual({
      error: 'Failed to get game',
      details: 'Query failed'
    })
  })

  it('should log game code being fetched', async () => {
    mockGetGameByCode.mockResolvedValueOnce(testGame)

    const mockRequest = createMockRequest('123456')
    await getGameHandler(mockRequest, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith('Getting game with code: 123456')
  })

  // Protected game tests
  describe('protected games', () => {
    const protectedGame: Game = {
      ...testGame,
      isProtected: true,
      participants: [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, token: 'alice-token' },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, token: 'bob-token' },
        { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, token: 'charlie-token' }
      ]
    }

    it('should return minimal info for protected game without token', async () => {
      mockGetGameByCode.mockResolvedValueOnce(protectedGame)

      const mockRequest = createMockRequest('123456')
      const response = await getGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.requiresToken).toBe(true)
      expect(body.isProtected).toBe(true)
      expect(body.code).toBe('123456')
      expect(body.name).toBe('Test Game')
      expect(body.participants).toBeUndefined()
      expect(body.assignments).toBeUndefined()
    })

    it('should return full game for organizer with valid token', async () => {
      mockGetGameByCode.mockResolvedValueOnce(protectedGame)

      const mockRequest = createMockRequest('123456', { organizerToken: 'token-123' })
      const response = await getGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.participants).toHaveLength(3)
      expect(body.assignments).toHaveLength(3)
      expect(body.organizerToken).toBe('token-123')
    })

    it('should return sanitized game for participant with valid token', async () => {
      mockGetGameByCode.mockResolvedValueOnce(protectedGame)

      const mockRequest = createMockRequest('123456', { participantToken: 'alice-token' })
      const response = await getGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.authenticatedParticipantId).toBe('p1')
      expect(body.organizerToken).toBe('') // Hidden
      expect(body.organizerEmail).toBeUndefined() // Hidden
      // Only Alice should have her token visible
      const alice = body.participants.find((p: any) => p.id === 'p1')
      const bob = body.participants.find((p: any) => p.id === 'p2')
      expect(alice.token).toBe('alice-token')
      expect(bob.token).toBeUndefined()
      // Only Alice's assignment (p1 -> p2) should be included, not the giver assignment
      expect(body.assignments).toHaveLength(1)
      expect(body.assignments).toContainEqual({ giverId: 'p1', receiverId: 'p2' })
      // giverHasConfirmed flag should be included (p3 gives to p1, check their confirmation status)
      expect(body.giverHasConfirmed).toBeDefined()
      expect(body.giverHasConfirmed).toBe(false)
    })

    it('should return 403 for invalid participant token', async () => {
      mockGetGameByCode.mockResolvedValueOnce(protectedGame)

      const mockRequest = createMockRequest('123456', { participantToken: 'invalid-token' })
      const response = await getGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(403)
      expect(response.jsonBody).toEqual({ error: 'Invalid participant token' })
    })
  })

  // Non-protected game with participantId filtering
  describe('non-protected games with participantId', () => {
    it('should return filtered game for participant with participantId', async () => {
      mockGetGameByCode.mockResolvedValueOnce(testGame)

      const mockRequest = createMockRequest('123456', { participantId: 'p1' })
      const response = await getGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(200)
      const body = response.jsonBody as any
      expect(body.authenticatedParticipantId).toBe('p1')
      expect(body.organizerToken).toBe('') // Hidden
      // Only p1's assignment (p1 -> p2) should be included
      expect(body.assignments).toHaveLength(1)
      expect(body.assignments).toContainEqual({ giverId: 'p1', receiverId: 'p2' })
      // giverHasConfirmed flag should be included (p3 gives to p1, check their confirmation status)
      expect(body.giverHasConfirmed).toBeDefined()
      expect(body.giverHasConfirmed).toBe(false)
    })
  })
})
