import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Gift, Link as LinkIcon, Eye, Star, ArrowsClockwise, CheckCircle, Envelope } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'

interface ParticipantGuideViewProps {
  onBack: () => void
}

export function ParticipantGuideView({ onBack }: ParticipantGuideViewProps) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-between items-center p-4 border-b">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={20} />
          {t('back')}
        </Button>
        <LanguageToggle />
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-accent/20 p-4 rounded-full">
              <Gift size={48} weight="duotone" className="text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-primary">
            {t('guideParticipantTitle')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('guideParticipantSubtitle')}
          </p>
        </div>

        {/* How to Join */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <LinkIcon size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideJoinTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideJoinDesc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('guideJoinOption1Title')}</p>
              <p className="text-sm text-muted-foreground">{t('guideJoinOption1Desc')}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('guideJoinOption2Title')}</p>
              <p className="text-sm text-muted-foreground">{t('guideJoinOption2Desc')}</p>
            </div>
          </div>
        </Card>

        {/* View Assignment */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
              <Eye size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideViewAssignmentTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideViewAssignmentDesc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideViewAssignmentItem1')}</li>
              <li>{t('guideViewAssignmentItem2')}</li>
              <li>{t('guideViewAssignmentItem3')}</li>
            </ul>
          </div>
        </Card>

        {/* Add Wish */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
              <Star size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideWishTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideWishDesc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideWishItem1')}</li>
              <li>{t('guideWishItem2')}</li>
              <li>{t('guideWishItem3')}</li>
            </ul>
          </div>
        </Card>

        {/* Request Reassignment */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
              <ArrowsClockwise size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideReassignTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideReassignDesc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideReassignItem1')}</li>
              <li>{t('guideReassignItem2')}</li>
              <li>{t('guideReassignItem3')}</li>
            </ul>
          </div>
        </Card>

        {/* Confirm Assignment */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
              <CheckCircle size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideConfirmTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideConfirmDesc')}</p>
        </Card>

        <Separator />

        {/* Protected Games Info */}
        <Card className="p-6 space-y-4 border-primary/20 bg-primary/5">
          <h3 className="text-lg font-semibold text-primary">{t('guideProtectedTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('guideProtectedDesc')}</p>
          <div className="bg-background/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideProtectedItem1')}</li>
              <li>{t('guideProtectedItem2')}</li>
              <li>{t('guideProtectedItem3')}</li>
            </ul>
          </div>
        </Card>

        {/* Email Notifications */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Envelope size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideEmailTitle')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideEmailDesc')}</p>
        </Card>

        {/* Tips */}
        <Card className="p-6 space-y-4 border-accent/20 bg-accent/5">
          <h3 className="text-lg font-semibold">{t('guideParticipantTipsTitle')}</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
            <li>{t('guideParticipantTip1')}</li>
            <li>{t('guideParticipantTip2')}</li>
            <li>{t('guideParticipantTip3')}</li>
          </ul>
        </Card>

        {/* Back Button */}
        <div className="flex justify-center pt-4">
          <Button onClick={onBack} size="lg" className="gap-2">
            <ArrowLeft size={20} />
            {t('goHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
