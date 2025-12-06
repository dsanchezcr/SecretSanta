import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CircleNotch, UserPlus } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'
import { toast } from 'sonner'
import { isValidEmail } from '@/lib/utils'
import { Game } from '@/lib/types'

interface JoinInvitationViewProps {
  gameCode: string
  invitationToken: string
  onJoinSuccess: (game: Game, participantId: string) => void
  onBack: () => void
}

export function JoinInvitationView({ gameCode, invitationToken, onJoinSuccess, onBack }: JoinInvitationViewProps) {
  const { t, language } = useLanguage()
  const [isJoining, setIsJoining] = useState(false)
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [desiredGift, setDesiredGift] = useState('')
  const [wish, setWish] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    
    if (!trimmedName) {
      toast.error(t('participantNameExists'))
      return
    }
    
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      toast.error(t('invalidEmailFormat'))
      return
    }
    
    setIsJoining(true)
    
    try {
      // Try API first
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
      const response = await fetch(`${API_BASE_URL}/games/${gameCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'joinInvitation',
          invitationToken,
          participantName: trimmedName,
          participantEmail: trimmedEmail || undefined,
          desiredGift: desiredGift.trim() || undefined,
          wish: wish.trim() || undefined,
          language
        })
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || 'Failed to join game')
      }
      
      const updatedGame = await response.json() as Game
      
      // Find the newly added participant by name (should be the last one added)
      const newParticipant = updatedGame.participants.find(p => p.name === trimmedName)
      if (!newParticipant) {
        throw new Error('Failed to find participant in updated game')
      }
      
      toast.success(t('joinSuccess'))
      onJoinSuccess(updatedGame, newParticipant.id)
      
    } catch (error: any) {
      console.error('Error joining game:', error)
      
      // Check for specific error messages
      if (error.message.includes('Invalid invitation token')) {
        toast.error(t('invalidInvitationToken'))
      } else if (error.message.includes('name already exists')) {
        toast.error(t('participantNameAlreadyExists'))
      } else if (error.message.includes('Email address already in use')) {
        toast.error(t('emailAlreadyInUse'))
      } else {
        toast.error(t('joinError'))
      }
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('back')}
          </Button>
          <LanguageToggle />
        </div>

        <Card className="p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <UserPlus className="w-8 h-8 text-green-600 dark:text-green-400" weight="duotone" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('joinGameTitle')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('joinGameDesc')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-base">
                {t('yourName')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('yourNamePlaceholder')}
                required
                className="mt-2"
                disabled={isJoining}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-base">
                {t('participantEmail')}
              </Label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('participantEmailOptional')}
              </p>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('participantEmailPlaceholder')}
                className="mt-2"
                disabled={isJoining}
              />
            </div>

            <div>
              <Label htmlFor="desiredGift" className="text-base">
                {t('yourDesiredGift')}
              </Label>
              <Input
                id="desiredGift"
                type="text"
                value={desiredGift}
                onChange={(e) => setDesiredGift(e.target.value)}
                placeholder={t('yourDesiredGiftPlaceholder')}
                className="mt-2"
                disabled={isJoining}
              />
            </div>

            <div>
              <Label htmlFor="wish" className="text-base">
                {t('yourGiftWish')}
              </Label>
              <Textarea
                id="wish"
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder={t('yourGiftWishPlaceholder')}
                rows={3}
                className="mt-2 resize-none"
                disabled={isJoining}
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2 h-12 text-lg"
              disabled={isJoining || !name.trim()}
            >
              {isJoining ? (
                <>
                  <CircleNotch className="w-5 h-5 animate-spin" />
                  {t('joining')}
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" weight="bold" />
                  {t('joinGameButton')}
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
