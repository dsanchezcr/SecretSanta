import { deleteGameHandler } from '../functions/deleteGame'
import * as cosmosdb from '../shared/cosmosdb'
import * as telemetry from '../shared/telemetry'
import { HttpRequest, InvocationContext } from '@azure/functions'
import { Game } from '../shared/types'

// Mock the cosmosdb module
jest.mock('../shared/cosmosdb')

// Mock the telemetry module
jest.mock('../shared/telemetry', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn(),
  ApiErrorCode: {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
  },
  createErrorResponse: jest.fn((code, message) => ({ code, message })),
  getHttpStatusForError: jest.fn((code) => {
    switch (code) {
      case 'UNAUTHORIZED': return 401
      case 'FORBIDDEN': return 403
      case 'NOT_FOUND': return 404
      case 'SERVICE_UNAVAILABLE': return 503
      default: return 500
    }
  })
}))

const mockGetDatabaseStatus = jest.mocked(cosmosdb.getDatabaseStatus)
const mockGetGameByCode = jest.mocked(cosmosdb.getGameByCode)
const mockDeleteGame = jest.mocked(cosmosdb.deleteGame)

describe('deleteGame function', () => {
  let mockContext: InvocationContext

  beforeEach(() => {
    jest.clearAllMocks()
    mockContext = {
      invocationId: 'test-request-id',
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as InvocationContext
    
    // Default: database connected
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
  })

  const createMockRequest = (params: { code?: string }, query?: string, headers?: Record<string, string>) => {
    return {
      params,
      query: new URLSearchParams(query || ''),
      headers: new Map(Object.entries(headers || {}))
    } as unknown as HttpRequest
  }

  const mockGame: Game = {
    id: 'game-id-123',
    code: '123456',
    name: 'Test Game',
    amount: '50',
    currency: 'USD',
    date: '2025-01-25',
    location: 'Test Location',
    allowReassignment: true,
    isProtected: true,
    generalNotes: '',
    participants: [
      { id: 'p1', name: 'Alice', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' },
      { id: 'p2', name: 'Bob', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' },
      { id: 'p3', name: 'Charlie', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' }
    ],
    assignments: [],
    reassignmentRequests: [],
    organizerToken: 'valid-organizer-token',
    createdAt: Date.now()
  }

  it('should return 503 when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Not connected' })
    
    const request = createMockRequest({ code: '123456' }, 'organizerToken=valid-organizer-token')
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(503)
    expect(result.jsonBody).toHaveProperty('error')
  })

  it('should return 401 when organizer token is missing', async () => {
    const request = createMockRequest({ code: '123456' })
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(401)
    expect(result.jsonBody).toEqual({
      error: 'Organizer token is required to delete a game'
    })
  })

  it('should return 404 when game is not found', async () => {
    mockGetGameByCode.mockResolvedValue(null)
    
    const request = createMockRequest({ code: '123456' }, 'organizerToken=some-token')
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(404)
    expect(result.jsonBody).toEqual({
      error: 'Game not found'
    })
  })

  it('should return 403 when organizer token is invalid', async () => {
    mockGetGameByCode.mockResolvedValue(mockGame)
    
    const request = createMockRequest({ code: '123456' }, 'organizerToken=wrong-token')
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(403)
    expect(result.jsonBody).toEqual({
      error: 'Invalid organizer token'
    })
  })

  it('should delete game successfully with valid token', async () => {
    mockGetGameByCode.mockResolvedValue(mockGame)
    mockDeleteGame.mockResolvedValue()
    
    const request = createMockRequest({ code: '123456' }, 'organizerToken=valid-organizer-token')
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(200)
    expect(result.jsonBody).toEqual({
      success: true,
      message: 'Game deleted successfully',
      deletedCode: '123456'
    })
    expect(mockDeleteGame).toHaveBeenCalledWith('game-id-123')
  })

  it('should accept organizer token from header', async () => {
    mockGetGameByCode.mockResolvedValue(mockGame)
    mockDeleteGame.mockResolvedValue()
    
    const request = createMockRequest({ code: '123456' }, '', { 'x-organizer-token': 'valid-organizer-token' })
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(200)
    expect(mockDeleteGame).toHaveBeenCalledWith('game-id-123')
  })

  it('should return 500 on database error', async () => {
    mockGetGameByCode.mockRejectedValue(new Error('Database error'))
    
    const request = createMockRequest({ code: '123456' }, 'organizerToken=valid-organizer-token')
    const result = await deleteGameHandler(request, mockContext)

    expect(result.status).toBe(500)
    expect(result.jsonBody).toHaveProperty('error', 'Failed to delete game')
    expect(mockContext.error).toHaveBeenCalled()
  })
})
