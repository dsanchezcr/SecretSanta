import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Gift, Key, Users, WhatsappLogo, FacebookLogo, XLogo, MessengerLogo, ShareNetwork, Envelope, CircleNotch, CheckCircle, ShieldCheck, User } from '@phosphor-icons/react'
import { Game } from '@/lib/types'
import { useLanguage } from './useLanguage'
import { copyToClipboard, buildShareableUrl } from '@/lib/game-utils'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { checkApiStatus, sendOrganizerEmailAPI, sendAllParticipantEmailsAPI } from '@/lib/api'

interface GameCreatedViewProps {
  game: Game
  onContinue: () => void
  emailResults?: {
    organizerEmailSent: boolean
    participantEmailsSent: number
    participantEmailsFailed: number
  }
}

export function GameCreatedView({ game, onContinue, emailResults }: GameCreatedViewProps) {
  const { t, language } = useLanguage()
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [sendingOrganizerEmail, setSendingOrganizerEmail] = useState(false)
  const [sendingParticipantEmails, setSendingParticipantEmails] = useState(false)
  const [organizerEmailSent, setOrganizerEmailSent] = useState(emailResults?.organizerEmailSent || false)
  const [participantEmailsSent, setParticipantEmailsSent] = useState(emailResults?.participantEmailsSent || 0)
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null)

  // Check if email service is available
  useEffect(() => {
    const checkEmail = async () => {
      const status = await checkApiStatus()
      setEmailConfigured(status.emailConfigured)
    }
    checkEmail()
  }, [])

  const hasOrganizerEmail = !!game.organizerEmail
  const participantsWithEmail = game.participants.filter(p => p.email).length

  const handleSendOrganizerEmail = async () => {
    if (!game.organizerEmail) return
    
    setSendingOrganizerEmail(true)
    try {
      await sendOrganizerEmailAPI(game.code, game.organizerToken, language)
      setOrganizerEmailSent(true)
      toast.success(t('emailSent'))
    } catch {
      toast.error(t('emailsFailed').replace('{count}', '1'))
    } finally {
      setSendingOrganizerEmail(false)
    }
  }

  const handleSendParticipantEmails = async () => {
    if (participantsWithEmail === 0) return
    
    setSendingParticipantEmails(true)
    try {
      const result = await sendAllParticipantEmailsAPI(game.code, game.organizerToken, language)
      if (result.sent && result.sent > 0) {
        setParticipantEmailsSent(result.sent)
        toast.success(t('emailsSentToParticipants').replace('{count}', String(result.sent)))
      }
      if (result.failed && result.failed > 0) {
        toast.error(t('emailsFailed').replace('{count}', String(result.failed)))
      }
    } catch {
      toast.error(t('emailServiceNotConfigured'))
    } finally {
      setSendingParticipantEmails(false)
    }
  }

  // Generate the participant link using current origin (works for localhost, staging, production)
  // Include language parameter so participants see the game in the organizer's language
  const participantLink = buildShareableUrl({ code: game.code, lang: language })
  // Organizer link includes both game code and token for validation
  const organizerLink = buildShareableUrl({ code: game.code, organizer: game.organizerToken, lang: language })

  // Generate individual participant link with token
  const getParticipantLink = (participantToken: string) => 
    buildShareableUrl({ code: game.code, participant: participantToken, lang: language })

  // Generate share message based on current language
  const getShareMessage = () => {
    return t('shareMessage')
      .replace('{eventName}', game.name)
      .replace('{code}', game.code)
      .replace('{link}', participantLink)
  }

  const handleCopyIndividualLink = async (participantId: string, participantToken: string) => {
    try {
      await copyToClipboard(getParticipantLink(participantToken))
      setCopiedParticipantId(participantId)
      toast.success(t('individualLinkCopied'))
      setTimeout(() => setCopiedParticipantId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyCode = async () => {
    try {
      await copyToClipboard(game.code)
      toast.success(t('codeCopied'))
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyParticipantLink = async () => {
    try {
      await copyToClipboard(participantLink)
      toast.success(t('participantLinkCopied'))
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyOrganizerLink = async () => {
    try {
      await copyToClipboard(organizerLink)
      toast.success(t('linkCopied'))
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(getShareMessage())
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const handleShareFacebook = () => {
    const url = encodeURIComponent(participantLink)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank')
  }

  const handleShareX = () => {
    const message = encodeURIComponent(getShareMessage())
    window.open(`https://twitter.com/intent/tweet?text=${message}`, '_blank')
  }

  const handleShareMessenger = () => {
    const url = encodeURIComponent(participantLink)
    // Messenger share works best with app_id, but also works with just the link
    window.open(`https://www.facebook.com/dialog/send?link=${url}&redirect_uri=${encodeURIComponent(window.location.origin)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="p-8 space-y-8 shadow-2xl border-2">
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center"
            >
              <div className="bg-secondary/20 p-6 rounded-full">
                <Gift size={64} weight="duotone" className="text-secondary" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-3xl font-display font-bold text-secondary">
                {t('gameCreated')}
              </h1>
              <p className="text-muted-foreground mt-2">
                {t('gameCreatedDesc')}
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Participant Links - Show individual links for protected games */}
            {game.isProtected ? (
              <div className="space-y-3 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={24} className="text-primary shrink-0 mt-0.5" weight="duotone" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {t('individualParticipantLinks')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('individualParticipantLinksDesc')}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {game.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User size={18} className="text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{participant.name}</span>
                      </div>
                      <Button
                        variant={copiedParticipantId === participant.id ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleCopyIndividualLink(participant.id, participant.token!)}
                        className="gap-2 shrink-0"
                      >
                        {copiedParticipantId === participant.id ? (
                          <>
                            <CheckCircle size={14} className="text-green-600" />
                            {t('codeCopied').replace('!', '')}
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            {t('copyIndividualLink')}
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Non-protected game - show single shared link */
              <div className="space-y-3 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users size={24} className="text-primary shrink-0 mt-0.5" weight="duotone" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {t('participantLink')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('participantLinkDesc')}
                    </p>
                  </div>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <p className="text-sm font-mono text-muted-foreground break-all select-all">
                    {participantLink}
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyParticipantLink}
                  className="w-full gap-2"
                >
                  <Copy size={16} />
                  {t('copyParticipantLink')}
                </Button>

                {/* Social Media Share Buttons - only for non-protected games */}
                <div className="pt-3 border-t border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ShareNetwork size={18} className="text-primary" weight="duotone" />
                    <p className="text-sm font-medium text-foreground">
                      {t('shareOnSocialMedia')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareWhatsApp}
                      className="gap-2 hover:bg-green-50 hover:border-green-500 hover:text-green-600"
                    >
                      <WhatsappLogo size={18} weight="fill" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareFacebook}
                      className="gap-2 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600"
                    >
                      <FacebookLogo size={18} weight="fill" />
                      Facebook
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareX}
                      className="gap-2 hover:bg-gray-100 hover:border-gray-800 hover:text-gray-800"
                    >
                      <XLogo size={18} weight="fill" />
                      X
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareMessenger}
                      className="gap-2 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-500"
                    >
                      <MessengerLogo size={18} weight="fill" />
                      Messenger
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Game Code - Only show prominently for non-protected games */}
            {!game.isProtected && (
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('gameCode')}
                </p>
                <Badge
                  variant="outline"
                  className="text-4xl font-mono font-bold py-4 px-8 cursor-pointer hover:bg-accent/20 transition-colors border-2 border-accent"
                  onClick={handleCopyCode}
                >
                  {game.code}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCode}
                  className="gap-2"
                >
                  <Copy size={16} />
                  {t('copyCode')}
                </Button>
              </div>
            )}

            {/* Organizer Link */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Key size={24} className="text-amber-600 shrink-0 mt-0.5" weight="duotone" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t('organizerLink')}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {t('organizerOnly')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('organizerLinkDesc')}
                  </p>
                </div>
              </div>
              <div className="bg-background rounded-md p-3 border">
                <p className="text-xs font-mono text-muted-foreground break-all select-all">
                  {organizerLink}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyOrganizerLink}
                className="w-full gap-2"
              >
                <Copy size={16} />
                {t('copyOrganizerLink')}
              </Button>
            </div>

            {/* Email Notifications Section - Only show if email is configured and there are emails */}
            {emailConfigured && (hasOrganizerEmail || participantsWithEmail > 0) && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Envelope size={20} className="text-primary" weight="duotone" />
                  <p className="text-sm font-semibold text-foreground">
                    {t('emailNotifications')}
                  </p>
                </div>
                
                {/* Send email to organizer */}
                {hasOrganizerEmail && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('sendOrganizerEmail')}</p>
                      <p className="text-xs text-muted-foreground">{game.organizerEmail}</p>
                    </div>
                    {organizerEmailSent ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle size={14} className="text-green-600" />
                        {t('emailSent')}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendOrganizerEmail}
                        disabled={sendingOrganizerEmail}
                        className="gap-2"
                      >
                        {sendingOrganizerEmail ? (
                          <>
                            <CircleNotch size={14} className="animate-spin" />
                            {t('sendingEmail')}
                          </>
                        ) : (
                          <>
                            <Envelope size={14} />
                            {t('sendOrganizerEmail')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Send emails to participants */}
                {participantsWithEmail > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('sendParticipantEmails')}</p>
                      <p className="text-xs text-muted-foreground">
                        {participantsWithEmail} {t('participants').toLowerCase()}
                      </p>
                    </div>
                    {participantEmailsSent > 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle size={14} className="text-green-600" />
                        {participantEmailsSent} {t('emailsSent')}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendParticipantEmails}
                        disabled={sendingParticipantEmails}
                        className="gap-2"
                      >
                        {sendingParticipantEmails ? (
                          <>
                            <CircleNotch size={14} className="animate-spin" />
                            {t('sendingEmails')}
                          </>
                        ) : (
                          <>
                            <Envelope size={14} />
                            {t('sendParticipantEmails')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Button size="lg" className="w-full" onClick={onContinue}>
              {t('goToGame')}
            </Button>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  )
}
