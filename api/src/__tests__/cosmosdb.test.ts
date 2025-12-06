import { Game, Participant, Assignment } from '../shared/types'

// Mock the @azure/cosmos module
const mockCreate = jest.fn()
const mockReplace = jest.fn()
const mockDelete = jest.fn()
const mockRead = jest.fn()
const mockQuery = jest.fn()
const mockCreateIfNotExists = jest.fn()

jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      containers: {
        createIfNotExists: mockCreateIfNotExists
      }
    }),
    databases: {
      createIfNotExists: jest.fn().mockResolvedValue({})
    }
  }))
}))

// We need to reset modules to properly test the cosmosdb module
let cosmosModule: typeof import('../shared/cosmosdb')

describe('cosmosdb', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    
    // Reset mocks
    mockCreateIfNotExists.mockResolvedValue({ 
      container: {
        items: {
          create: mockCreate,
          query: jest.fn().mockReturnValue({
            fetchAll: mockQuery
          })
        },
        item: jest.fn().mockReturnValue({
          read: mockRead,
          replace: mockReplace,
          delete: mockDelete
        })
      }
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getDatabaseStatus', () => {
    it('should return not connected when COSMOS_ENDPOINT is missing', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('COSMOS_ENDPOINT')
    })

    it('should return not connected when COSMOS_KEY is missing', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('COSMOS_ENDPOINT')
    })

    it('should return connected when both env vars are set and connection succeeds', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(true)
      expect(status.error).toBeNull()
    })

    it.skip('should return not connected when connection fails', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      
      // Make the createIfNotExists always throw an error (for all 10 retries)
      mockCreateIfNotExists.mockRejectedValue(new Error('Connection failed'))
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(false)
      expect(status.error).toContain('Connection failed')
    })
  })

  describe('initializeStorage', () => {
    it('should use default database name when not specified', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      delete process.env.COSMOS_DATABASE_NAME
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(true)
    })

    it('should use custom database name when specified', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      process.env.COSMOS_DATABASE_NAME = 'custom-db'
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const status = cosmosModule.getDatabaseStatus()
      expect(status.connected).toBe(true)
    })
  })
})

describe('cosmosdb operations', () => {
  const mockContainer = {
    items: {
      create: mockCreate,
      query: jest.fn().mockReturnValue({
        fetchAll: mockQuery
      })
    },
    item: jest.fn().mockReturnValue({
      read: mockRead,
      replace: mockReplace,
      delete: mockDelete
    })
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    
    process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
    process.env.COSMOS_KEY = 'test-key'
    
    mockCreateIfNotExists.mockResolvedValue({ container: mockContainer })
    mockQuery.mockResolvedValue({ resources: [] })
    mockRead.mockResolvedValue({ resource: null })
    mockCreate.mockResolvedValue({ resource: {} })
    mockReplace.mockResolvedValue({ resource: {} })
    mockDelete.mockResolvedValue({})
  })

  const createTestGame = (): Game => ({
    id: 'game-1',
    code: '123456',
    name: 'Test Game',
    amount: '20',
    currency: 'USD',
    date: '2025-12-25',
    location: 'Test Location',
    allowReassignment: true,
    isProtected: true,
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
  })

  describe('getGameByCode', () => {
    it('should return game when found', async () => {
      const testGame = createTestGame()
      mockQuery.mockResolvedValueOnce({ resources: [testGame] })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.getGameByCode('123456')
      expect(result).toEqual(testGame)
    })

    it('should return null when game not found', async () => {
      mockQuery.mockResolvedValueOnce({ resources: [] })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.getGameByCode('999999')
      expect(result).toBeNull()
    })

    it('should throw error when database not connected', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      await expect(cosmosModule.getGameByCode('123456')).rejects.toThrow('Database not available')
    })
  })

  describe('getGameById', () => {
    it('should return game when found', async () => {
      const testGame = createTestGame()
      mockRead.mockResolvedValueOnce({ resource: testGame })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.getGameById('game-1')
      expect(result).toEqual(testGame)
    })

    it('should return null when game not found', async () => {
      mockRead.mockResolvedValueOnce({ resource: null })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.getGameById('nonexistent')
      expect(result).toBeNull()
    })

    it('should return null on 404 error', async () => {
      const error: any = new Error('Not found')
      error.code = 404
      mockRead.mockRejectedValueOnce(error)
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.getGameById('nonexistent')
      expect(result).toBeNull()
    })

    it('should throw on other errors', async () => {
      const error: any = new Error('Server error')
      error.code = 500
      mockRead.mockRejectedValueOnce(error)
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      await expect(cosmosModule.getGameById('game-1')).rejects.toThrow('Server error')
    })
  })

  describe('createGame', () => {
    it('should create game successfully', async () => {
      const testGame = createTestGame()
      mockCreate.mockResolvedValueOnce({ resource: testGame })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.createGame(testGame)
      expect(result).toEqual(testGame)
      expect(mockCreate).toHaveBeenCalledWith(testGame)
    })

    it('should throw error when database not connected', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      await expect(cosmosModule.createGame(createTestGame())).rejects.toThrow('Database not available')
    })
  })

  describe('updateGame', () => {
    it('should update game successfully', async () => {
      const testGame = createTestGame()
      const updatedGame = { ...testGame, name: 'Updated Game' }
      mockReplace.mockResolvedValueOnce({ resource: updatedGame })
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const result = await cosmosModule.updateGame(updatedGame)
      expect(result).toEqual(updatedGame)
    })
  })

  describe('deleteGame', () => {
    it('should delete game successfully', async () => {
      mockDelete.mockResolvedValueOnce({})
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      await expect(cosmosModule.deleteGame('game-1')).resolves.not.toThrow()
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('getCosmosClient', () => {
    it('should throw when not connected', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      expect(() => cosmosModule.getCosmosClient()).toThrow('Database not available')
    })

    it('should return client when connected', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const client = cosmosModule.getCosmosClient()
      expect(client).toBeDefined()
    })
  })

  describe('getDatabase', () => {
    it('should throw when not connected', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      expect(() => cosmosModule.getDatabase()).toThrow('Database not available')
    })

    it('should return database when connected', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const db = cosmosModule.getDatabase()
      expect(db).toBeDefined()
    })
  })

  describe('getContainer', () => {
    it('should throw when not connected', async () => {
      delete process.env.COSMOS_ENDPOINT
      delete process.env.COSMOS_KEY
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      await expect(cosmosModule.getContainer()).rejects.toThrow('Database not available')
    })

    it('should return container when connected', async () => {
      process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com'
      process.env.COSMOS_KEY = 'test-key'
      
      cosmosModule = await import('../shared/cosmosdb')
      await cosmosModule.initializeStorage()
      
      const cont = await cosmosModule.getContainer()
      expect(cont).toBeDefined()
    })
  })
})
