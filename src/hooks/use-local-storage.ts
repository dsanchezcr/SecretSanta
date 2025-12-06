import { useState, useEffect, useCallback } from 'react'

/**
 * A localStorage-based state hook with persistence.
 * Data persists in browser localStorage.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T | undefined, (updater: T | ((prev: T | undefined) => T)) => void, () => void] {
  const storageKey = `secretsanta:${key}`
  
  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(storageKey)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error)
      return initialValue
    }
  })

  // Update localStorage when value changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (storedValue === undefined) {
        window.localStorage.removeItem(storageKey)
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(storedValue))
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${storageKey}":`, error)
    }
  }, [storageKey, storedValue])

  // Setter that accepts value or updater function
  const setValue = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setStoredValue(prev => {
      if (typeof updater === 'function') {
        return (updater as (prev: T | undefined) => T)(prev)
      }
      return updater
    })
  }, [])

  // Delete function
  const deleteValue = useCallback(() => {
    setStoredValue(undefined)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  return [storedValue, setValue, deleteValue]
}
