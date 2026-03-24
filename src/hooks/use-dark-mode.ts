import { useEffect } from 'react'
import { useLocalStorage } from './use-local-storage'

export function useDarkMode() {
  const [isDark, setIsDark] = useLocalStorage<boolean>(
    'dark-mode',
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const root = document.getElementById('app')
    if (!root) return
    if (isDark) {
      root.classList.add('dark-theme')
    } else {
      root.classList.remove('dark-theme')
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(prev => !prev) }
}
