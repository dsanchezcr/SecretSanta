import { performCleanup, performHardDelete, cleanupExpiredGamesHandler } from '../functions/cleanupExpiredGames'
import * as cosmosdb from '../shared/cosmosdb'
import { HttpRequest, InvocationContext } from '@azure/functions'
import { Game } from '../shared/types'

// Mock the cosmosdb module, but keep applyArchiveMetadata as the real implementation
jest.mock('../shared/cosmosdb', () => ({
  ...jest.requireActual('../shared/cosmosdb'),
  getDatabaseStatus: jest.fn(),
  getContainer: jest.fn()
}))

// Mock the telemetry module
jest.mock('../shared/telemetry', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn()
}))

const mockGetDatabaseStatus = jest.mocked(cosmosdb.getDatabaseStatus)
const mockGetContainer = jest.mocked(cosmosdb.getContainer)

// Helper to create a minimal mock HttpRequest
function createMockRequest(headers: Record<string, string> = {}): HttpRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null
    }
  } as unknown as HttpRequest
}

describe('cleanupExpiredGames HTTP function', () => {
  let mockContext: InvocationContext
  let mockContainer: any
  let mockQuery: jest.Mock
  let mockDelete: jest.Mock
  let mockReplace: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up mock context
    mockContext = {
      invocationId: 'test-invocation-id',
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as InvocationContext

    // Separate mocks for hard delete vs soft delete (replace)
    mockDelete = jest.fn().mockResolvedValue({})
    mockReplace = jest.fn().mockResolvedValue({})

    // Set up mock container
    mockQuery = jest.fn()
    mockContainer = {
      items: {
        query: mockQuery
      },
      item: jest.fn().mockReturnValue({
        delete: mockDelete,
        replace: mockReplace
      })
    }

    // Default: database connected
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetContainer.mockResolvedValue(mockContainer)

    // Default: CLEANUP_SECRET is set
    process.env.CLEANUP_SECRET = 'test-secret'
  })

  afterEach(() => {
    delete process.env.CLEANUP_SECRET
  })

  const createMockGame = (id: string, code: string, date: string): Game => ({
    id,
    code,
    name: 'Test Game',
    amount: '50',
    currency: 'USD',
    date,
    location: 'Test Location',
    allowReassignment: true,
    isProtected: false,
    generalNotes: '',
    participants: [
      { id: 'p1', name: 'Alice', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' },
      { id: 'p2', name: 'Bob', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' },
      { id: 'p3', name: 'Charlie', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false, wish: '', desiredGift: '' }
    ],
    assignments: [],
    reassignmentRequests: [],
    organizerToken: 'test-organizer-token',
    createdAt: Date.now()
  })

  // ============================================================
  // HTTP handler – authentication tests
  // ============================================================

  describe('HTTP handler authentication', () => {
    it('should return 401 when X-Cleanup-Secret header is missing', async () => {
      const request = createMockRequest({})
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(401)
      expect(mockGetContainer).not.toHaveBeenCalled()
    })

    it('should return 401 when X-Cleanup-Secret header is wrong', async () => {
      const request = createMockRequest({ 'x-cleanup-secret': 'wrong-secret' })
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(401)
      expect(mockGetContainer).not.toHaveBeenCalled()
    })

    it('should return 500 when CLEANUP_SECRET env var is not set', async () => {
      delete process.env.CLEANUP_SECRET
      const request = createMockRequest({ 'x-cleanup-secret': 'test-secret' })
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(500)
    })

    it('should return 200 when secret is valid and no expired games', async () => {
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [] })
      })
      const request = createMockRequest({ 'x-cleanup-secret': 'test-secret' })
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(200)
    })

    it('should return 500 when cleanup throws an error', async () => {
      mockGetContainer.mockRejectedValue(new Error('Container error'))
      const request = createMockRequest({ 'x-cleanup-secret': 'test-secret' })
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(500)
    })

    it('should return 503 when database is not connected', async () => {
      mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Not connected' })
      const request = createMockRequest({ 'x-cleanup-secret': 'test-secret' })
      const response = await cleanupExpiredGamesHandler(request, mockContext)
      expect(response.status).toBe(503)
    })
  })

  // ============================================================
  // Core cleanup logic (performCleanup) tests
  // ============================================================

  describe('performCleanup', () => {
    it('should return null when database is not connected', async () => {
      mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Not connected' })

      const result = await performCleanup(mockContext)

      expect(result).toBeNull()
      expect(mockContext.error).toHaveBeenCalledWith('❌ Database not connected, skipping cleanup')
      expect(mockGetContainer).not.toHaveBeenCalled()
    })

    it('should return zero counts when no expired games found', async () => {
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [] })
      })

      const result = await performCleanup(mockContext)

      expect(result).toEqual({ archivedCount: 0, failedCount: 0, totalFound: 0 })
      expect(mockContext.log).toHaveBeenCalledWith('✅ No expired games found')
      expect(mockContainer.item).not.toHaveBeenCalled()
    })

    it('should archive expired games and return correct counts', async () => {
      const expiredGames = [
        createMockGame('game-1', '111111', '2025-11-01'),
        createMockGame('game-2', '222222', '2025-11-15')
      ]

      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
      })

      const result = await performCleanup(mockContext)

      expect(mockContainer.item).toHaveBeenCalledTimes(2)
      expect(mockContainer.item).toHaveBeenCalledWith('game-1', 'game-1')
      expect(mockContainer.item).toHaveBeenCalledWith('game-2', 'game-2')
      expect(mockReplace).toHaveBeenCalledTimes(2)
      expect(mockDelete).not.toHaveBeenCalled()
      expect(result).toEqual({ archivedCount: 2, failedCount: 0, totalFound: 2 })
      expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete: 2 archived, 0 failed'))
    })

    it('should handle partial failures gracefully', async () => {
      const expiredGames = [
        createMockGame('game-1', '111111', '2025-11-01'),
        createMockGame('game-2', '222222', '2025-11-15')
      ]

      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
      })

      // First archive succeeds, second fails
      mockReplace
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Archive failed'))

      const result = await performCleanup(mockContext)

      expect(result).toEqual({ archivedCount: 1, failedCount: 1, totalFound: 2 })
      expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete: 1 archived, 1 failed'))
      expect(mockContext.error).toHaveBeenCalledWith(expect.stringContaining('Failed to archive game 222222'))
    })

    it('should throw when a query error occurs', async () => {
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockRejectedValue(new Error('Query failed'))
      })

      await expect(performCleanup(mockContext)).rejects.toThrow('Query failed')
    })

    it('should use correct cutoff date query (3 days ago)', async () => {
      // Freeze time so the cutoff date calculation is deterministic
      jest.useFakeTimers()
      const fixedNow = new Date('2025-11-10T00:00:00Z')
      jest.setSystemTime(fixedNow)

      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [] })
      })

      try {
        await performCleanup(mockContext)

        // Verify the query was called with a date parameter
        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.stringContaining('c.date <= @cutoffDate'),
            parameters: expect.arrayContaining([
              expect.objectContaining({ name: '@cutoffDate' })
            ])
          })
        )

        // Verify the cutoff date is exactly 3 days before the fixed "now"
        const callArgs = mockQuery.mock.calls[0][0]
        const cutoffDateString = callArgs.parameters[0].value
        const expectedDate = new Date(fixedNow)
        expectedDate.setDate(expectedDate.getDate() - 3)
        expect(cutoffDateString).toBe(expectedDate.toISOString().split('T')[0])
      } finally {
        jest.useRealTimers()
      }
    })

    it('should log game details when archiving', async () => {
      const expiredGames = [
        createMockGame('game-1', '123456', '2025-11-01')
      ]

      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
      })

      await performCleanup(mockContext)

      expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Archived game: 123456'))
      expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('event date: 2025-11-01'))
    })
  })

  describe('performHardDelete', () => {
    it('should return zero counts when database is not connected', async () => {
      mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Not connected' })

      const result = await performHardDelete(mockContext)

      expect(result.deletedCount).toBe(0)
      expect(result.failedCount).toBe(0)
      expect(mockGetContainer).not.toHaveBeenCalled()
    })

    it('should return zero counts when no old archived games exist', async () => {
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [] })
      })

      const result = await performHardDelete(mockContext)

      expect(result.deletedCount).toBe(0)
      expect(result.failedCount).toBe(0)
    })

    it('should hard-delete old archived games and return correct counts', async () => {
      const oldArchivedGame = {
        ...createMockGame('game-old', '999999', '2024-01-01'),
        isArchived: true,
        archivedAt: Date.now() - (35 * 24 * 60 * 60 * 1000)
      }
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [oldArchivedGame] })
      })
      mockDelete.mockResolvedValue({})

      const result = await performHardDelete(mockContext)

      expect(result.deletedCount).toBe(1)
      expect(result.failedCount).toBe(0)
    })

    it('should count failures when hard-delete fails', async () => {
      const oldArchivedGame = {
        ...createMockGame('game-old', '999999', '2024-01-01'),
        isArchived: true,
        archivedAt: Date.now() - (35 * 24 * 60 * 60 * 1000)
      }
      mockQuery.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [oldArchivedGame] })
      })
      mockDelete.mockRejectedValue(new Error('Delete failed'))

      const result = await performHardDelete(mockContext)

      expect(result.deletedCount).toBe(0)
      expect(result.failedCount).toBe(1)
    })
  })
})
