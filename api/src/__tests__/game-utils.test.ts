import {
  generateGameCode,
  generateId,
  generateAssignments,
  reassignParticipant,
  validateDateString
} from '../shared/game-utils'
import { Participant, Assignment } from '../shared/types'

describe('game-utils', () => {
  describe('generateGameCode', () => {
    it('should generate a 6-digit string', () => {
      const code = generateGameCode()
      expect(code).toMatch(/^\d{6}$/)
    })

    it('should generate a number between 100000 and 999999', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateGameCode()
        const num = parseInt(code, 10)
        expect(num).toBeGreaterThanOrEqual(100000)
        expect(num).toBeLessThan(1000000)
      }
    })

    it('should generate unique codes', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 100; i++) {
        codes.add(generateGameCode())
      }
      // With 900000 possible codes, 100 should be unique
      expect(codes.size).toBeGreaterThan(90)
    })
  })

  describe('generateId', () => {
    it('should generate a non-empty string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100)
    })

    it('should contain alphanumeric characters', () => {
      const id = generateId()
      expect(id).toMatch(/^[a-z0-9]+$/i)
    })
  })

  describe('generateAssignments', () => {
    const createParticipants = (count: number): Participant[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `participant-${i}`,
        name: `Participant ${i}`,
        desiredGift: '',
        wish: '',
        hasPendingReassignmentRequest: false,
        hasConfirmedAssignment: false
      }))
    }

    it('should throw error for less than 3 participants', () => {
      const twoParticipants = createParticipants(2)
      expect(() => generateAssignments(twoParticipants)).toThrow('Need at least 3 participants')
    })

    it('should throw error for empty array', () => {
      expect(() => generateAssignments([])).toThrow('Need at least 3 participants')
    })

    it('should generate correct number of assignments', () => {
      const participants = createParticipants(5)
      const assignments = generateAssignments(participants)
      expect(assignments.length).toBe(5)
    })

    it('should ensure everyone gives exactly one gift', () => {
      const participants = createParticipants(5)
      const assignments = generateAssignments(participants)
      
      const giverIds = assignments.map(a => a.giverId)
      const uniqueGivers = new Set(giverIds)
      expect(uniqueGivers.size).toBe(5)
      
      participants.forEach(p => {
        expect(giverIds).toContain(p.id)
      })
    })

    it('should ensure everyone receives exactly one gift', () => {
      const participants = createParticipants(5)
      const assignments = generateAssignments(participants)
      
      const receiverIds = assignments.map(a => a.receiverId)
      const uniqueReceivers = new Set(receiverIds)
      expect(uniqueReceivers.size).toBe(5)
      
      participants.forEach(p => {
        expect(receiverIds).toContain(p.id)
      })
    })

    it('should not allow self-assignment', () => {
      // Run multiple times to catch randomness issues
      for (let i = 0; i < 50; i++) {
        const participants = createParticipants(5)
        const assignments = generateAssignments(participants)
        
        assignments.forEach(a => {
          expect(a.giverId).not.toBe(a.receiverId)
        })
      }
    })

    it('should work with exactly 3 participants', () => {
      const participants = createParticipants(3)
      const assignments = generateAssignments(participants)
      
      expect(assignments.length).toBe(3)
      assignments.forEach(a => {
        expect(a.giverId).not.toBe(a.receiverId)
      })
    })

    it('should work with large number of participants', () => {
      const participants = createParticipants(50)
      const assignments = generateAssignments(participants)
      
      expect(assignments.length).toBe(50)
      const giverIds = new Set(assignments.map(a => a.giverId))
      const receiverIds = new Set(assignments.map(a => a.receiverId))
      expect(giverIds.size).toBe(50)
      expect(receiverIds.size).toBe(50)
    })
  })

  describe('reassignParticipant', () => {
    const createTestData = () => {
      const participants: Participant[] = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p4', name: 'Diana', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
      ]
      
      const assignments: Assignment[] = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'p4' },
        { giverId: 'p4', receiverId: 'p1' }
      ]
      
      return { participants, assignments }
    }

    it('should change the receiver for the specified participant by swapping', () => {
      const { participants, assignments } = createTestData()
      const newAssignments = reassignParticipant('p1', assignments, participants)
      
      expect(newAssignments).not.toBeNull()
      const p1Assignment = newAssignments!.find(a => a.giverId === 'p1')
      expect(p1Assignment).toBeDefined()
      // Should be different from original (p2) and not self (p1)
      expect(p1Assignment!.receiverId).not.toBe('p1')
    })

    it('should swap assignments with another giver, not just reassign', () => {
      const { participants, assignments } = createTestData()
      const newAssignments = reassignParticipant('p1', assignments, participants)
      
      expect(newAssignments).not.toBeNull()
      // After swap, each receiver should still have exactly one giver
      const receiverCounts = new Map<string, number>()
      newAssignments!.forEach(a => {
        const count = receiverCounts.get(a.receiverId) || 0
        receiverCounts.set(a.receiverId, count + 1)
      })
      
      // Each receiver should appear exactly once
      receiverCounts.forEach((count) => {
        expect(count).toBe(1)
      })
    })

    it('should return original assignments if participant not found', () => {
      const { participants, assignments } = createTestData()
      const newAssignments = reassignParticipant('nonexistent', assignments, participants)
      
      expect(newAssignments).toEqual(assignments)
    })

    it('should not assign to self', () => {
      const { participants, assignments } = createTestData()
      
      for (let i = 0; i < 20; i++) {
        const newAssignments = reassignParticipant('p1', assignments, participants)
        expect(newAssignments).not.toBeNull()
        const p1Assignment = newAssignments!.find(a => a.giverId === 'p1')
        expect(p1Assignment!.receiverId).not.toBe('p1')
      }
    })

    it('should prioritize swapping with non-confirmed participants', () => {
      const participants: Participant[] = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: true },
        { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p4', name: 'Diana', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: true }
      ]
      
      const assignments: Assignment[] = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'p4' },
        { giverId: 'p4', receiverId: 'p1' }
      ]
      
      const newAssignments = reassignParticipant('p1', assignments, participants)
      expect(newAssignments).not.toBeNull()
      
      // P1 should have swapped with p3 (non-confirmed) not p2 or p4 (confirmed)
      const p1Assignment = newAssignments!.find(a => a.giverId === 'p1')
      const p3Assignment = newAssignments!.find(a => a.giverId === 'p3')
      expect(p1Assignment!.receiverId).toBe('p4')  // p1 now gives to p4 (was p3's receiver)
      expect(p3Assignment!.receiverId).toBe('p2')  // p3 now gives to p2 (was p1's receiver)
    })

    it('should return null when no valid swap is possible with 3 participants', () => {
      const participants: Participant[] = [
        { id: 'p1', name: 'Alice', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p2', name: 'Bob', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false },
        { id: 'p3', name: 'Charlie', desiredGift: '', wish: '', hasPendingReassignmentRequest: false, hasConfirmedAssignment: false }
      ]
      
      // p1 gives to p2, p2 gives to p3, p3 gives to p1
      // If p1 wants reassignment: can't swap with p2 (p2's receiver is p3, would make p1->p3 but p3 already gives to p1)
      // Can't swap with p3 (p3's receiver is p1, would make p1->p1 which is self)
      const assignments: Assignment[] = [
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p3' },
        { giverId: 'p3', receiverId: 'p1' }
      ]
      
      const newAssignments = reassignParticipant('p1', assignments, participants)
      
      // With 3 participants in a simple cycle, no valid swap exists
      // because any swap would result in either self-assignment or the same receiver
      expect(newAssignments).toBeNull()
    })
  })

  describe('validateDateString', () => {
    it('should accept valid YYYY-MM-DD dates', () => {
      const result = validateDateString('2025-12-21')
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.year).toBe(2025)
        expect(result.month).toBe(12)
        expect(result.day).toBe(21)
      }
    })

    it('should accept leap year February 29th', () => {
      const result = validateDateString('2028-02-29')
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.year).toBe(2028)
        expect(result.month).toBe(2)
        expect(result.day).toBe(29)
      }
    })

    it('should reject invalid format with missing leading zeros', () => {
      const result = validateDateString('2025-1-5')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date format. Expected YYYY-MM-DD')
      }
    })

    it('should reject invalid format with extra digits', () => {
      const result = validateDateString('02025-01-01')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date format. Expected YYYY-MM-DD')
      }
    })

    it('should reject MM/DD/YYYY format', () => {
      const result = validateDateString('12/21/2025')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date format. Expected YYYY-MM-DD')
      }
    })

    it('should reject incomplete date string', () => {
      const result = validateDateString('2025-12')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date format. Expected YYYY-MM-DD')
      }
    })

    it('should reject year out of range (too high)', () => {
      const result = validateDateString('2150-12-21')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date values. Year must be 1900-2100, month 1-12, day 1-31')
      }
    })

    it('should reject year out of range (too low)', () => {
      const result = validateDateString('1850-12-21')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date values. Year must be 1900-2100, month 1-12, day 1-31')
      }
    })

    it('should reject invalid month', () => {
      const result = validateDateString('2025-13-21')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date values. Year must be 1900-2100, month 1-12, day 1-31')
      }
    })

    it('should reject invalid day', () => {
      const result = validateDateString('2025-12-32')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date values. Year must be 1900-2100, month 1-12, day 1-31')
      }
    })

    it('should reject February 31st (invalid calendar date)', () => {
      const result = validateDateString('2026-02-31')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid calendar date. The date does not exist (e.g., February 31, April 31).')
      }
    })

    it('should reject April 31st (30-day month)', () => {
      const result = validateDateString('2026-04-31')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid calendar date. The date does not exist (e.g., February 31, April 31).')
      }
    })

    it('should reject February 29th in non-leap year', () => {
      const result = validateDateString('2025-02-29')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid calendar date. The date does not exist (e.g., February 31, April 31).')
      }
    })

    it('should reject date with whitespace', () => {
      const result = validateDateString('2025- 12-21')
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBe('Invalid date format. Expected YYYY-MM-DD')
      }
    })

    it('should accept dates at boundary of valid range', () => {
      const resultMin = validateDateString('1900-01-01')
      expect(resultMin.valid).toBe(true)

      const resultMax = validateDateString('2100-12-31')
      expect(resultMax.valid).toBe(true)
    })
  })
})
