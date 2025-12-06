import { cleanupExpiredGames } from '../functions/cleanupExpiredGames'
import * as cosmosdb from '../shared/cosmosdb'
import { InvocationContext, Timer } from '@azure/functions'
import { Game } from '../shared/types'

// Mock the cosmosdb module
jest.mock('../shared/cosmosdb')

// Mock the telemetry module
jest.mock('../shared/telemetry', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn()
}))

const mockGetDatabaseStatus = jest.mocked(cosmosdb.getDatabaseStatus)
const mockGetContainer = jest.mocked(cosmosdb.getContainer)

describe('cleanupExpiredGames timer function', () => {
  let mockContext: InvocationContext
  let mockTimer: Timer
  let mockContainer: any
  let mockQuery: jest.Mock
  let mockDelete: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up mock context
    mockContext = {
      invocationId: 'test-invocation-id',
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as InvocationContext

    // Set up mock timer
    mockTimer = {
      isPastDue: false,
      schedule: {
        adjustForDST: false
      },
      scheduleStatus: {
        last: new Date().toISOString(),
        next: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    }

    // Set up mock delete function
    mockDelete = jest.fn().mockResolvedValue({})

    // Set up mock container
    mockQuery = jest.fn()
    mockContainer = {
      items: {
        query: mockQuery
      },
      item: jest.fn().mockReturnValue({
        delete: mockDelete
      })
    }

    // Default: database connected
    mockGetDatabaseStatus.mockReturnValue({ connected: true, error: null })
    mockGetContainer.mockResolvedValue(mockContainer)
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

  it('should skip cleanup when database is not connected', async () => {
    mockGetDatabaseStatus.mockReturnValue({ connected: false, error: 'Not connected' })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.error).toHaveBeenCalledWith('❌ Database not connected, skipping cleanup')
    expect(mockGetContainer).not.toHaveBeenCalled()
  })

  it('should log when timer is past due', async () => {
    mockTimer.isPastDue = true
    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] })
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith('Timer is past due!')
  })

  it('should do nothing when no expired games found', async () => {
    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] })
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith('✅ No expired games found')
    expect(mockContainer.item).not.toHaveBeenCalled()
  })

  it('should delete expired games', async () => {
    const expiredGames = [
      createMockGame('game-1', '111111', '2025-11-01'),
      createMockGame('game-2', '222222', '2025-11-15')
    ]

    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContainer.item).toHaveBeenCalledTimes(2)
    expect(mockContainer.item).toHaveBeenCalledWith('game-1', 'game-1')
    expect(mockContainer.item).toHaveBeenCalledWith('game-2', 'game-2')
    expect(mockDelete).toHaveBeenCalledTimes(2)
    expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete: 2 deleted, 0 failed'))
  })

  it('should handle partial failures gracefully', async () => {
    const expiredGames = [
      createMockGame('game-1', '111111', '2025-11-01'),
      createMockGame('game-2', '222222', '2025-11-15')
    ]

    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
    })

    // First delete succeeds, second fails
    mockDelete
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Delete failed'))

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete: 1 deleted, 1 failed'))
    expect(mockContext.error).toHaveBeenCalledWith(expect.stringContaining('Failed to delete game 222222'))
  })

  it('should handle query errors', async () => {
    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockRejectedValue(new Error('Query failed'))
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.error).toHaveBeenCalledWith('❌ Error during cleanup:', expect.any(Error))
  })

  it('should use correct cutoff date query (3 days ago)', async () => {
    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] })
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    // Verify the query was called with a date parameter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM c WHERE c.date <= @cutoffDate',
        parameters: expect.arrayContaining([
          expect.objectContaining({ name: '@cutoffDate' })
        ])
      })
    )

    // Verify the cutoff date is approximately 3 days ago
    const callArgs = mockQuery.mock.calls[0][0]
    const cutoffDateString = callArgs.parameters[0].value
    const cutoffDate = new Date(cutoffDateString)
    const expectedDate = new Date()
    expectedDate.setDate(expectedDate.getDate() - 3)
    
    // Allow for 1 day tolerance in case of timezone differences
    const diffInDays = Math.abs((cutoffDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffInDays).toBeLessThan(1)
  })

  it('should log game details when deleting', async () => {
    const expiredGames = [
      createMockGame('game-1', '123456', '2025-11-01')
    ]

    mockQuery.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: expiredGames })
    })

    await cleanupExpiredGames(mockTimer, mockContext)

    expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('Deleted game: 123456'))
    expect(mockContext.log).toHaveBeenCalledWith(expect.stringContaining('event date: 2025-11-01'))
  })
})
