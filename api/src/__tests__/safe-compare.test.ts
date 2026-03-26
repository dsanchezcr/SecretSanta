import { safeCompare } from '../shared/game-utils'

describe('safeCompare', () => {
  it('should return true for matching strings', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true)
  })

  it('should return false for non-matching strings', () => {
    expect(safeCompare('abc123', 'xyz789')).toBe(false)
  })

  it('should return false for empty strings', () => {
    expect(safeCompare('', 'abc')).toBe(false)
    expect(safeCompare('abc', '')).toBe(false)
  })

  it('should return false for undefined values', () => {
    expect(safeCompare(undefined, 'abc')).toBe(false)
    expect(safeCompare('abc', undefined)).toBe(false)
    expect(safeCompare(undefined, undefined)).toBe(false)
  })

  it('should return false for different length strings', () => {
    expect(safeCompare('short', 'longer-string')).toBe(false)
  })
})
