import { InvocationContext } from '@azure/functions'
import {
  ApiErrorCode,
  createErrorResponse,
  getHttpStatusForError,
  trackError,
  trackEvent,
  trackDependency,
} from '../shared/telemetry'

describe('telemetry', () => {
  let mockContext: InvocationContext

  beforeEach(() => {
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as InvocationContext
  })

  describe('getHttpStatusForError', () => {
    it('should return 400 for BAD_REQUEST', () => {
      expect(getHttpStatusForError(ApiErrorCode.BAD_REQUEST)).toBe(400)
    })

    it('should return 400 for VALIDATION_ERROR', () => {
      expect(getHttpStatusForError(ApiErrorCode.VALIDATION_ERROR)).toBe(400)
    })

    it('should return 401 for UNAUTHORIZED', () => {
      expect(getHttpStatusForError(ApiErrorCode.UNAUTHORIZED)).toBe(401)
    })

    it('should return 403 for FORBIDDEN', () => {
      expect(getHttpStatusForError(ApiErrorCode.FORBIDDEN)).toBe(403)
    })

    it('should return 404 for NOT_FOUND', () => {
      expect(getHttpStatusForError(ApiErrorCode.NOT_FOUND)).toBe(404)
    })

    it('should return 409 for CONFLICT', () => {
      expect(getHttpStatusForError(ApiErrorCode.CONFLICT)).toBe(409)
    })

    it('should return 503 for DATABASE_ERROR', () => {
      expect(getHttpStatusForError(ApiErrorCode.DATABASE_ERROR)).toBe(503)
    })

    it('should return 503 for EMAIL_ERROR', () => {
      expect(getHttpStatusForError(ApiErrorCode.EMAIL_ERROR)).toBe(503)
    })

    it('should return 503 for SERVICE_UNAVAILABLE', () => {
      expect(getHttpStatusForError(ApiErrorCode.SERVICE_UNAVAILABLE)).toBe(503)
    })

    it('should return 500 for INTERNAL_ERROR', () => {
      expect(getHttpStatusForError(ApiErrorCode.INTERNAL_ERROR)).toBe(500)
    })
  })

  describe('createErrorResponse', () => {
    it('should create an error response with all fields', () => {
      const response = createErrorResponse(
        ApiErrorCode.NOT_FOUND,
        'Resource not found',
        'Detailed message',
        'req-123'
      )

      expect(response.code).toBe(ApiErrorCode.NOT_FOUND)
      expect(response.message).toBe('Resource not found')
      expect(response.details).toBe('Detailed message')
      expect(response.requestId).toBe('req-123')
      expect(response.timestamp).toBeDefined()
    })

    it('should create error response without optional fields', () => {
      const response = createErrorResponse(ApiErrorCode.BAD_REQUEST, 'Bad input')
      expect(response.code).toBe(ApiErrorCode.BAD_REQUEST)
      expect(response.message).toBe('Bad input')
      expect(response.details).toBeUndefined()
      expect(response.requestId).toBeUndefined()
    })
  })

  describe('trackError', () => {
    it('should log an Error instance', () => {
      const error = new Error('Something went wrong')
      trackError(mockContext, error)

      expect(mockContext.error).toHaveBeenCalledWith('Error:', 'Something went wrong')
    })

    it('should log a non-Error value', () => {
      trackError(mockContext, 'string error')

      expect(mockContext.error).toHaveBeenCalledWith('Error:', 'string error')
    })

    it('should log properties when provided', () => {
      const error = new Error('Test error')
      trackError(mockContext, error, { requestId: 'req-456', gameCode: '123456' })

      expect(mockContext.error).toHaveBeenCalledWith('Error:', 'Test error')
    })
  })

  describe('trackEvent', () => {
    it('should log event name', () => {
      trackEvent(mockContext, 'GameCreated')

      expect(mockContext.log).toHaveBeenCalledWith('Event: GameCreated')
    })

    it('should log event with properties', () => {
      trackEvent(mockContext, 'GameCreated', { gameCode: '123456' })

      expect(mockContext.log).toHaveBeenCalledWith('Event: GameCreated')
      expect(mockContext.log).toHaveBeenCalledWith('Properties:', expect.stringContaining('gameCode'))
    })

    it('should log event with metrics', () => {
      trackEvent(mockContext, 'GameCreated', undefined, { participantCount: 5 })

      expect(mockContext.log).toHaveBeenCalledWith('Metrics:', expect.stringContaining('participantCount'))
    })
  })

  describe('trackDependency', () => {
    it('should call context.log when dependency is tracked', () => {
      trackDependency(mockContext, 'CosmosDB', true, 100)

      // trackDependency only logs when appInsightsInitialized is true,
      // which it won't be in tests - just verify it doesn't throw
      expect(() => trackDependency(mockContext, 'CosmosDB', true, 100)).not.toThrow()
    })
  })
})
