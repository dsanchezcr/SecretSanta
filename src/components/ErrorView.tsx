import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertTriangleIcon, Mail, User, Shield, Loader2 } from 'lucide-react'
import { TranslationKey } from '@/lib/translations'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'
import { recoverOrganizerLinkAPI, recoverParticipantLinkAPI } from '@/lib/api'
import { toast } from 'sonner'

export type ErrorType = 'invalid-token' | 'protected-game' | 'unexpected'

interface ErrorViewProps {
  errorType: ErrorType
  gameCode?: string
  onGoHome: () => void
  onSubmitToken?: (token: string) => void
  emailConfigured?: boolean
}

export function ErrorView({ errorType, gameCode, onGoHome, onSubmitToken, emailConfigured = false }: ErrorViewProps) {
  const { t, language } = useLanguage()
  const [tokenInput, setTokenInput] = useState('')
  
  // Participant recovery state
  const [showParticipantRecovery, setShowParticipantRecovery] = useState(false)
  const [participantEmail, setParticipantEmail] = useState('')
  const [isRecoveringParticipant, setIsRecoveringParticipant] = useState(false)
  const [participantRecoverySubmitted, setParticipantRecoverySubmitted] = useState(false)
  
  // Organizer recovery state
  const [showOrganizerRecovery, setShowOrganizerRecovery] = useState(false)
  const [organizerEmail, setOrganizerEmail] = useState('')
  const [isRecoveringOrganizer, setIsRecoveringOrganizer] = useState(false)
  const [organizerRecoverySubmitted, setOrganizerRecoverySubmitted] = useState(false)

  // Log error to console in English for debugging
  const errorMessages: Record<ErrorType, string> = {
    'invalid-token': 'Invalid or expired token. User cannot access the game with this link.',
    'protected-game': 'Protected game requires unique link. User must ask organizer for their personal link.',
    'unexpected': 'An unexpected error occurred. Please try again or contact the organizer.',
  }

  console.error(`[SecretSanta Error] ${errorMessages[errorType]}`)

  const titleAndDescKeys: Record<ErrorType, { title: TranslationKey; desc: TranslationKey }> = {
    'invalid-token': { title: 'errorInvalidToken', desc: 'errorInvalidTokenDesc' },
    'protected-game': { title: 'errorProtectedGame', desc: 'errorProtectedGameDesc' },
    'unexpected': { title: 'errorUnexpected', desc: 'errorUnexpectedDesc' },
  }

  const keys = titleAndDescKeys[errorType]

  // Only show token input for invalid-token and protected-game errors
  const showTokenInput = (errorType === 'invalid-token' || errorType === 'protected-game') && onSubmitToken && gameCode

  const handleSubmitToken = () => {
    if (tokenInput.trim() && onSubmitToken) {
      onSubmitToken(tokenInput.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tokenInput.trim()) {
      handleSubmitToken()
    }
  }

  // Participant recovery handler
  const handleRecoverParticipantLink = async () => {
    if (!participantEmail.trim() || !gameCode) return

    setIsRecoveringParticipant(true)
    try {
      await recoverParticipantLinkAPI(gameCode, participantEmail.trim(), language as any)
      // Success or email doesn't match (we show same message for security)
      setParticipantRecoverySubmitted(true)
      toast.success(t('recoveryEmailSent'))
    } catch {
      toast.error(t('recoveryFailed'))
    } finally {
      setIsRecoveringParticipant(false)
    }
  }

  const handleParticipantRecoveryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && participantEmail.trim()) {
      handleRecoverParticipantLink()
    }
  }

  // Organizer recovery handler
  const handleRecoverOrganizerLink = async () => {
    if (!organizerEmail.trim() || !gameCode) return

    setIsRecoveringOrganizer(true)
    try {
      const result = await recoverOrganizerLinkAPI(gameCode, organizerEmail.trim(), language as any)
      
      if (result.code === 'NO_EMAIL_REGISTERED') {
        // Game doesn't have organizer email registered
        toast.error(t('recoveryNotAvailable'))
      } else {
        // Success or email doesn't match (we show same message for security)
        setOrganizerRecoverySubmitted(true)
        toast.success(t('recoveryEmailSent'))
      }
    } catch {
      toast.error(t('recoveryFailed'))
    } finally {
      setIsRecoveringOrganizer(false)
    }
  }

  const handleOrganizerRecoveryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && organizerEmail.trim()) {
      handleRecoverOrganizerLink()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Language Toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <div className="p-6 space-y-6">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
              <AlertTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Error Content */}
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {t('errorPageTitle')}
            </h1>
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
              {t(keys.title)}
            </h2>
            <p className="text-muted-foreground">
              {t(keys.desc)}
            </p>
          </div>

          {/* Token Input Section */}
          {showTokenInput && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{t('participantAccessTitle')}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-input">{t('enterAccessToken')}</Label>
                  <Input
                    id="token-input"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('accessTokenPlaceholder')}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('accessTokenHint')}
                  </p>
                </div>
                <Button
                  onClick={handleSubmitToken}
                  className="w-full"
                  size="lg"
                  disabled={!tokenInput.trim()}
                >
                  {t('submitToken')}
                </Button>

                {/* Help for participants without token - with email recovery option */}
                {emailConfigured ? (
                  !showParticipantRecovery ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>{t('noTokenQuestion')}</strong> {t('participantRecoveryOption')}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowParticipantRecovery(true)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {t('recoverParticipantLink')}
                      </Button>
                    </div>
                  ) : participantRecoverySubmitted ? (
                    <div className="space-y-3">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                        <Mail className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                          {t('participantRecoveryEmailSentDesc')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        onClick={() => {
                          setShowParticipantRecovery(false)
                          setParticipantRecoverySubmitted(false)
                          setParticipantEmail('')
                        }}
                      >
                        {t('back')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        {t('participantRecoveryDesc')}
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="participant-email" className="text-emerald-800 dark:text-emerald-200">{t('recoveryEmailLabel')}</Label>
                        <Input
                          id="participant-email"
                          type="email"
                          value={participantEmail}
                          onChange={(e) => setParticipantEmail(e.target.value)}
                          onKeyDown={handleParticipantRecoveryKeyDown}
                          placeholder={t('participantEmailRecoveryPlaceholder')}
                          disabled={isRecoveringParticipant}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setShowParticipantRecovery(false)
                            setParticipantEmail('')
                          }}
                          disabled={isRecoveringParticipant}
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={handleRecoverParticipantLink}
                          disabled={!participantEmail.trim() || isRecoveringParticipant}
                        >
                          {isRecoveringParticipant ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('sending')}
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              {t('sendRecoveryEmail')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>{t('noTokenQuestion')}</strong> {t('contactOrganizerForLink')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Organizer Recovery Section */}
          {showTokenInput && emailConfigured && (
            <>
              <Separator />
              
              {!showOrganizerRecovery ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">{t('organizerAccessTitle')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('organizerForgotLink')}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowOrganizerRecovery(true)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {t('recoverOrganizerLink')}
                  </Button>
                </div>
              ) : organizerRecoverySubmitted ? (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                    <Mail className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      {t('recoveryEmailSentDesc')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => {
                      setShowOrganizerRecovery(false)
                      setOrganizerRecoverySubmitted(false)
                      setOrganizerEmail('')
                    }}
                  >
                    {t('back')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">{t('organizerRecoveryTitle')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('organizerRecoveryDesc')}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="organizer-email">{t('recoveryEmailLabel')}</Label>
                    <Input
                      id="organizer-email"
                      type="email"
                      value={organizerEmail}
                      onChange={(e) => setOrganizerEmail(e.target.value)}
                      onKeyDown={handleOrganizerRecoveryKeyDown}
                      placeholder={t('recoveryEmailPlaceholder')}
                      disabled={isRecoveringOrganizer}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowOrganizerRecovery(false)
                        setOrganizerEmail('')
                      }}
                      disabled={isRecoveringOrganizer}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleRecoverOrganizerLink}
                      disabled={!organizerEmail.trim() || isRecoveringOrganizer}
                    >
                      {isRecoveringOrganizer ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('sending')}
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          {t('sendRecoveryEmail')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* No email service warning for organizers */}
          {showTokenInput && !emailConfigured && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span className="font-medium">{t('organizerAccessTitle')}</span>
                </div>
                <div className="bg-muted/50 border border-border rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">
                    {t('recoveryNotAvailableNoEmail')}
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action Button */}
          <Button
            onClick={onGoHome}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {t('goHome')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
