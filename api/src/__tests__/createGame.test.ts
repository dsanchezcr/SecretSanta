import { HttpRequest, InvocationContext } from '@azure/functions'
import { createGameHandler } from '../functions/createGame'
import { Game } from '../shared/types'

// Mock the modules
jest.mock('../shared/cosmosdb', () => ({
  createGame: jest.fn(),
  getDatabaseStatus: jest.fn()
}))

jest.mock('../shared/game-utils', () => ({
  generateGameCode: jest.fn().mockReturnValue('123456'),
  generateId: jest.fn().mockImplementation(() => 'mock-id-' + Math.random().toString(36).substr(2, 9)),
  generateAssignments: jest.fn().mockImplementation((participants) => 
    participants.map((p: any, i: number) => ({
      giverId: p.id,
      receiverId: participants[(i + 1) % participants.length].id
    }))
  )
}))

import { createGame, getDatabaseStatus } from '../shared/cosmosdb'
import { generateGameCode, generateId, generateAssignments } from '../shared/game-utils'

const mockCreateGame = createGame as jest.Mock
const mockGetDatabaseStatus = getDatabaseStatus as jest.Mock
const mockGenerateGameCode = generateGameCode as jest.Mock
const mockGenerateId = generateId as jest.Mock
const mockGenerateAssignments = generateAssignments as jest.Mock

describe('createGame function', () => {
  let mockContext: InvocationContext

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext

    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockCreateGame.mockImplementation((game) => Promise.resolve(game))
    
    // Reset the mock implementations
    let idCounter = 0
    mockGenerateId.mockImplementation(() => `mock-id-${idCounter++}`)
  })

  const createMockRequest = (body: any): HttpRequest => ({
    method: 'POST',
    url: 'http://localhost/api/games',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    query: new URLSearchParams(),
    params: {},
    json: jest.fn().mockResolvedValue(body)
  } as unknown as HttpRequest)

  it('should create a game successfully with valid data', async () => {
    const requestBody = {
      name: 'Christmas 2025',
      amount: '20',
      currency: 'USD',
      date: '2025-12-25',
      location: 'Office',
      allowReassignment: true,
      generalNotes: 'Bring wrapped gifts',
      participants: [
        { name: 'Alice', desiredGift: '', wish: '' },
        { name: 'Bob', desiredGift: '', wish: '' },
        { name: 'Charlie', desiredGift: '', wish: '' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(201)
    expect(response.jsonBody).toBeDefined()
    
    const game = response.jsonBody as Game
    expect(game.code).toBe('123456')
    expect(game.name).toBe('Christmas 2025')
    expect(game.participants).toHaveLength(3)
    expect(game.assignments).toHaveLength(3)
  })

  it('should return 503 when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({ 
      connected: false, 
      error: 'Connection failed' 
    })

    const requestBody = {
      name: 'Test',
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(503)
    expect(response.jsonBody).toEqual({
      error: 'Database not available',
      details: 'Connection failed'
    })
  })

  it('should return 400 when name is missing', async () => {
    const requestBody = {
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(400)
    expect(response.jsonBody).toEqual({
      error: 'Invalid game data. Need at least 3 participants.'
    })
  })

  it('should return 400 when participants are missing', async () => {
    const requestBody = {
      name: 'Test Game'
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(400)
  })

  it('should return 400 when less than 3 participants', async () => {
    const requestBody = {
      name: 'Test Game',
      participants: [
        { name: 'Alice' },
        { name: 'Bob' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(400)
    expect(response.jsonBody).toEqual({
      error: 'Invalid game data. Need at least 3 participants.'
    })
  })

  it('should use default values when optional fields are missing', async () => {
    const requestBody = {
      name: 'Minimal Game',
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(201)
    
    const game = response.jsonBody as Game
    expect(game.amount).toBe('')
    expect(game.currency).toBe('USD')
    expect(game.date).toBe('')
    expect(game.location).toBe('')
    expect(game.allowReassignment).toBe(true)
    expect(game.generalNotes).toBe('')
  })

  it('should handle allowReassignment = false', async () => {
    const requestBody = {
      name: 'No Reassignment Game',
      allowReassignment: false,
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(201)
    const game = response.jsonBody as Game
    expect(game.allowReassignment).toBe(false)
  })

  it('should return 500 on database error', async () => {
    mockCreateGame.mockRejectedValueOnce(new Error('Database write failed'))

    const requestBody = {
      name: 'Test Game',
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(500)
    expect(response.jsonBody).toEqual({
      error: 'Failed to create game',
      details: 'Database write failed'
    })
  })

  it('should initialize participant fields correctly', async () => {
    const requestBody = {
      name: 'Test Game',
      participants: [
        { name: 'Alice', desiredGift: 'A book', wish: 'Something nice' },
        { name: 'Bob' },
        { name: 'Charlie', desiredGift: '', wish: '' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    const response = await createGameHandler(mockRequest, mockContext)

    expect(response.status).toBe(201)
    const game = response.jsonBody as Game
    
    game.participants.forEach(p => {
      expect(p.id).toBeDefined()
      expect(p.hasConfirmedAssignment).toBe(false)
      expect(p.hasPendingReassignmentRequest).toBe(false)
      expect(p.desiredGift).toBeDefined()
    })
    
    // Verify reassignmentRequests is initialized
    expect(game.reassignmentRequests).toBeDefined()
    expect(game.reassignmentRequests).toHaveLength(0)
  })

  it('should log game creation', async () => {
    const requestBody = {
      name: 'Test Game',
      participants: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ]
    }

    const mockRequest = createMockRequest(requestBody)
    await createGameHandler(mockRequest, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Creating new game'))
  })

  describe('protected games', () => {
    it('should create protected game with tokens by default', async () => {
      const requestBody = {
        name: 'Protected Game',
        participants: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      }

      const mockRequest = createMockRequest(requestBody)
      const response = await createGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(201)
      const game = response.jsonBody as Game
      expect(game.isProtected).toBe(true)
      game.participants.forEach(p => {
        expect(p.token).toBeDefined()
        expect(p.token).not.toBe('')
      })
    })

    it('should create non-protected game without tokens when isProtected is false', async () => {
      const requestBody = {
        name: 'Non-Protected Game',
        isProtected: false,
        participants: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      }

      const mockRequest = createMockRequest(requestBody)
      const response = await createGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(201)
      const game = response.jsonBody as Game
      expect(game.isProtected).toBe(false)
      game.participants.forEach(p => {
        expect(p.token).toBeUndefined()
      })
    })

    it('should generate unique tokens for each participant', async () => {
      // Reset ID counter for unique tokens
      let idCounter = 100
      mockGenerateId.mockImplementation(() => `unique-token-${idCounter++}`)

      const requestBody = {
        name: 'Protected Game',
        isProtected: true,
        participants: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      }

      const mockRequest = createMockRequest(requestBody)
      const response = await createGameHandler(mockRequest, mockContext)

      expect(response.status).toBe(201)
      const game = response.jsonBody as Game
      const tokens = game.participants.map(p => p.token)
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(tokens.length)
    })
  })
})
