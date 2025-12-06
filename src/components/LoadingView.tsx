import { CircleNotch } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'

export function LoadingView() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <CircleNotch size={48} className="animate-spin text-primary mx-auto" />
        <p className="text-lg text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  )
}
