import { 
  Participant, 
  Assignment, 
  Game,
  UpdateGameDetailsPayload,
  AddParticipantPayload,
  RemoveParticipantPayload,
  RequestReassignmentPayload,
  UpdateWishPayload,
  UpdateParticipantEmailPayload,
  GameUpdatePayload,
  ApproveReassignmentPayload,
  ReassignAllPayload,
  CancelReassignmentRequestPayload,
  ReassignmentRequest
} from '../shared/types'

describe('types', () => {
  describe('Participant interface', () => {
    it('should create valid participant object', () => {
      const participant: Participant = {
        id: 'p1',
        name: 'Alice',
        desiredGift: 'Headphones',
        wish: 'A book',
        hasPendingReassignmentRequest: false,
        hasConfirmedAssignment: false
      }

      expect(participant.id).toBe('p1')
      expect(participant.name).toBe('Alice')
      expect(participant.desiredGift).toBe('Headphones')
      expect(participant.wish).toBe('A book')
      expect(participant.hasPendingReassignmentRequest).toBe(false)
      expect(participant.hasConfirmedAssignment).toBe(false)
    })
  })

  describe('Assignment interface', () => {
    it('should create valid assignment object', () => {
      const assignment: Assignment = {
        giverId: 'p1',
        receiverId: 'p2'
      }

      expect(assignment.giverId).toBe('p1')
      expect(assignment.receiverId).toBe('p2')
    })
  })

  describe('ReassignmentRequest interface', () => {
    it('should create valid reassignment request object', () => {
      const request: ReassignmentRequest = {
        participantId: 'p1',
        participantName: 'Alice',
        requestedAt: Date.now()
      }

      expect(request.participantId).toBe('p1')
      expect(request.participantName).toBe('Alice')
      expect(request.requestedAt).toBeDefined()
    })
  })

  describe('Game interface', () => {
    it('should create valid game object', () => {
      const game: Game = {
        id: 'game-1',
        code: '123456',
        name: 'Christmas Exchange',
        amount: '20',
        currency: 'USD',
        date: '2025-12-25',
        location: 'Office',
        allowReassignment: true,
        isProtected: false,
        generalNotes: 'Bring wrapped gifts',
        participants: [],
        assignments: [],
        reassignmentRequests: [],
        organizerToken: 'token-123',
        createdAt: Date.now()
      }

      expect(game.id).toBe('game-1')
      expect(game.code).toBe('123456')
      expect(game.name).toBe('Christmas Exchange')
      expect(game.currency).toBe('USD')
      expect(game.allowReassignment).toBe(true)
      expect(game.reassignmentRequests).toHaveLength(0)
    })
  })

  describe('GameUpdatePayload union type', () => {
    it('should accept UpdateGameDetailsPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'updateGameDetails',
        organizerToken: 'token-123',
        name: 'New Name',
        amount: '50'
      }

      expect(payload.action).toBe('updateGameDetails')
    })

    it('should accept AddParticipantPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'New Person'
      }

      expect(payload.action).toBe('addParticipant')
    })

    it('should accept RemoveParticipantPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'removeParticipant',
        organizerToken: 'token-123',
        participantId: 'p1'
      }

      expect(payload.action).toBe('removeParticipant')
    })

    it('should accept RequestReassignmentPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'requestReassignment',
        participantId: 'p1'
      }

      expect(payload.action).toBe('requestReassignment')
    })

    it('should accept UpdateWishPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'updateWish',
        participantId: 'p1',
        wish: 'A new bicycle'
      }

      expect(payload.action).toBe('updateWish')
      if (payload.action === 'updateWish') {
        expect(payload.wish).toBe('A new bicycle')
      }
    })

    it('should accept ApproveReassignmentPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'approveReassignment',
        organizerToken: 'token-123',
        participantId: 'p1'
      }

      expect(payload.action).toBe('approveReassignment')
    })

    it('should accept ReassignAllPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'reassignAll',
        organizerToken: 'token-123'
      }

      expect(payload.action).toBe('reassignAll')
    })

    it('should accept CancelReassignmentRequestPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'cancelReassignmentRequest',
        organizerToken: 'token-123',
        participantId: 'p1'
      }

      expect(payload.action).toBe('cancelReassignmentRequest')
    })

    it('should accept UpdateParticipantEmailPayload', () => {
      const payload: GameUpdatePayload = {
        action: 'updateParticipantEmail',
        participantId: 'p1',
        email: 'alice@example.com'
      }

      expect(payload.action).toBe('updateParticipantEmail')
      if (payload.action === 'updateParticipantEmail') {
        expect(payload.email).toBe('alice@example.com')
      }
    })

    it('should accept AddParticipantPayload with email', () => {
      const payload: GameUpdatePayload = {
        action: 'addParticipant',
        organizerToken: 'token-123',
        participantName: 'New Person',
        participantEmail: 'newperson@example.com'
      }

      expect(payload.action).toBe('addParticipant')
      if (payload.action === 'addParticipant') {
        expect(payload.participantEmail).toBe('newperson@example.com')
      }
    })
  })
})
