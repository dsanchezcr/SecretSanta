import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Game, Participant } from '@/lib/types'
import { useLanguage } from './useLanguage'
import { ArrowLeft, Gift, CircleNotch, Envelope } from '@phosphor-icons/react'
import { LanguageToggle } from './LanguageToggle'
import { updateWishAPI, updateParticipantEmailAPI, checkApiStatus } from '@/lib/api'
import { toast } from 'sonner'

interface ParticipantSelectionViewProps {
  game: Game
  onParticipantSelected: (participant: Participant) => void
  onUpdateGame: (game: Game) => void
  onBack: () => void
  emailConfigured?: boolean
}

export function ParticipantSelectionView({
  game,
  onParticipantSelected,
  onUpdateGame,
  onBack,
  emailConfigured = false
}: ParticipantSelectionViewProps) {
  const { t, language } = useLanguage()
  const [selectedId, setSelectedId] = useState<string>('')
  const [showWishInput, setShowWishInput] = useState(false)
  const [wishText, setWishText] = useState('')
  const [emailText, setEmailText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Defensive check: ensure participants array exists
  const participants = game.participants || []
  const selectedParticipant = participants.find(p => p.id === selectedId)

  const handleSelectParticipant = (id: string) => {
    setSelectedId(id)
    const participant = participants.find(p => p.id === id)
    if (participant) {
      // Load wish if participant has added one, otherwise use desiredGift from organizer
      setWishText(participant.wish || participant.desiredGift || '')
      setEmailText(participant.email || '')
    }
  }

  const handleContinue = () => {
    if (selectedParticipant) {
      // Show wish input step before going to assignment
      setShowWishInput(true)
    }
  }

  const handleSaveWish = async () => {
    if (!selectedParticipant) return

    setIsSaving(true)
    const updatedParticipant = { 
      ...selectedParticipant, 
      wish: wishText.trim(),
      email: emailText.trim() || undefined
    }
    
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available) {
        let updatedGame = await updateWishAPI(game.code, selectedParticipant.id, wishText.trim(), language)
        // Also update email if changed
        if (emailText.trim() !== (selectedParticipant.email || '')) {
          updatedGame = await updateParticipantEmailAPI(game.code, selectedParticipant.id, emailText.trim(), language)
        }
        onUpdateGame(updatedGame)
        toast.success(t('wishSaved'))
      } else {
        // Fallback to local update
        const updatedParticipants = participants.map(p =>
          p.id === selectedParticipant.id 
            ? { ...p, wish: wishText.trim(), email: emailText.trim() || undefined } 
            : p
        )
        onUpdateGame({ ...game, participants: updatedParticipants })
        toast.success(t('wishSaved'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save wish'
      toast.error(message)
      // Even on error, still fallback to local update and continue
      const updatedParticipants = participants.map(p =>
        p.id === selectedParticipant.id 
          ? { ...p, wish: wishText.trim(), email: emailText.trim() || undefined } 
          : p
      )
      onUpdateGame({ ...game, participants: updatedParticipants })
    } finally {
      setIsSaving(false)
      // Always navigate to assignment view after saving attempt
      onParticipantSelected(updatedParticipant)
    }
  }

  const handleSkipWish = () => {
    if (selectedParticipant) {
      onParticipantSelected(selectedParticipant)
    }
  }

  const handleBackToSelection = () => {
    setShowWishInput(false)
  }

  if (showWishInput && selectedParticipant) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex justify-between items-center p-4 border-b">
          <Button variant="ghost" onClick={handleBackToSelection} className="gap-2">
            <ArrowLeft size={20} />
            {t('back')}
          </Button>
          <LanguageToggle />
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-secondary/20 p-4 rounded-full">
                <Gift size={48} weight="duotone" className="text-secondary" />
              </div>
            </div>
            <h1 className="text-3xl font-display font-bold text-primary mb-2">
              {t('yourWish')}
            </h1>
            <p className="text-muted-foreground">
              {t('wishDescription')}
            </p>
          </div>

          <Card className="p-6 space-y-4">
            {/* Email field - only show if email service is configured and organizer didn't provide email */}
            {emailConfigured && !selectedParticipant.email && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Envelope size={16} />
                    {t('yourEmail')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder={t('yourEmailPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('yourEmailDesc')}
                  </p>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="wish">{t('yourWish')}</Label>
              <Textarea
                id="wish"
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                placeholder={t('yourWishPlaceholder')}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t('wishHint')}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={handleSkipWish}
                disabled={isSaving}
              >
                {t('skipWish')}
              </Button>
              <Button
                size="lg"
                className="flex-1 gap-2"
                onClick={handleSaveWish}
                disabled={isSaving}
              >
                {isSaving && <CircleNotch size={20} className="animate-spin" />}
                {selectedParticipant.wish ? t('updateAndContinue') : t('saveAndContinue')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-between items-center p-4 border-b">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={20} />
          {t('back')}
        </Button>
        <LanguageToggle />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-primary mb-2">
            {game.name}
          </h1>
          <p className="text-muted-foreground">
            {t('selectParticipantDesc')}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('selectParticipant')}</h2>

          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {participants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => handleSelectParticipant(participant.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedId === participant.id
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-accent/5'
                }`}
              >
                <span className="font-semibold text-lg">{participant.name}</span>
                {(participant.wish || participant.desiredGift) && (
                  <span className="ml-2 text-xs text-green-600">✓ {t('hasWish')}</span>
                )}
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleContinue}
            disabled={!selectedId}
          >
            {t('continue')}
          </Button>
        </Card>
      </div>
    </div>
  )
}
