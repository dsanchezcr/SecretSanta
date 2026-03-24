import { Moon, Sun } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useDarkMode } from '@/hooks/use-dark-mode'
import { useLanguage } from './useLanguage'

export function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode()
  const { t } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t('lightMode') : t('darkMode')}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  )
}
