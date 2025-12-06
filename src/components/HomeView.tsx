import { Gift, ShieldCheck, User, Users } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'

interface HomeViewProps {
  onCreateGame: () => void
  onJoinGame: (code: string) => void
  onPrivacy?: () => void
  onOrganizerGuide?: () => void
  onParticipantGuide?: () => void
}

export function HomeView({ onCreateGame, onJoinGame, onPrivacy, onOrganizerGuide, onParticipantGuide }: HomeViewProps) {
  const [gameCode, setGameCode] = useState('')
  const { t } = useLanguage()

  const handleJoin = () => {
    if (gameCode.trim().length === 6) {
      onJoinGame(gameCode.trim())
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex justify-end p-4">
        <LanguageToggle />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-accent/20 p-6 rounded-full">
                <Gift size={64} weight="duotone" className="text-primary" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-primary">
              {t('appName')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('welcomeDesc')}
            </p>
          </div>

          <div className="space-y-4">
            <Card className="p-6 space-y-4 shadow-lg border-2">
              <Button
                size="lg"
                className="w-full gap-2 text-base font-semibold"
                onClick={onCreateGame}
              >
                <Gift size={24} weight="bold" />
                {t('createGame')}
              </Button>
            </Card>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground font-medium">
                  {t('joinGame')}
                </span>
              </div>
            </div>

            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('enterCode')}
                </label>
                <Input
                  type="text"
                  placeholder={t('codePlaceholder')}
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-lg font-mono tracking-wider"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={handleJoin}
                disabled={gameCode.length !== 6}
              >
                {t('continue')}
              </Button>
            </Card>
          </div>

          {/* Guide Links */}
          {(onOrganizerGuide || onParticipantGuide) && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {onOrganizerGuide && (
                <Button
                  variant="outline"
                  onClick={onOrganizerGuide}
                  className="gap-2"
                >
                  <Users size={16} />
                  {t('guideOrganizerLink')}
                </Button>
              )}
              {onParticipantGuide && (
                <Button
                  variant="outline"
                  onClick={onParticipantGuide}
                  className="gap-2"
                >
                  <User size={16} />
                  {t('guideParticipantLink')}
                </Button>
              )}
            </div>
          )}

          {/* Privacy Link */}
          {onPrivacy && (
            <div className="text-center">
              <Button
                variant="link"
                onClick={onPrivacy}
                className="text-muted-foreground hover:text-primary gap-2"
              >
                <ShieldCheck size={16} />
                {t('privacyLink')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
