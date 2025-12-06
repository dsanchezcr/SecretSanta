import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MagnifyingGlass, House, Warning, Calendar, Trash, XCircle } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'
import { motion } from 'framer-motion'

interface GameNotFoundViewProps {
  onGoHome: () => void
}

export function GameNotFoundView({ onGoHome }: GameNotFoundViewProps) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-end items-center p-4 border-b">
        <LanguageToggle />
      </header>

      <div className="max-w-lg mx-auto px-4 py-16 space-y-6">
        {/* Icon and Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="bg-muted/50 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <MagnifyingGlass size={48} weight="duotone" className="text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-primary mb-2">
            {t('gameNotFoundTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('gameNotFoundDesc')}
          </p>
        </motion.div>

        {/* Possible Reasons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Warning size={20} className="text-amber-500" />
              {t('gameNotFoundTitle')}
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Trash size={20} className="text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{t('gameNotFoundReason1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <Calendar size={20} className="text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{t('gameNotFoundReason2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle size={20} className="text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{t('gameNotFoundReason3')}</span>
              </li>
            </ul>
          </Card>
        </motion.div>

        {/* Go Home Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <Button size="lg" onClick={onGoHome} className="gap-2">
            <House size={20} />
            {t('goHome')}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
