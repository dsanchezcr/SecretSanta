import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Gift, Users, Gear, PaperPlaneTilt, ChartBar, UserCirclePlus, ArrowsClockwise, Trash, Link as LinkIcon, Key } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'

interface OrganizerGuideViewProps {
  onBack: () => void
}

export function OrganizerGuideView({ onBack }: OrganizerGuideViewProps) {
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
            <div className="bg-primary/10 p-4 rounded-full">
              <Gift size={48} weight="duotone" className="text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-primary">
            {t('guideOrganizerTitle')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('guideOrganizerSubtitle')}
          </p>
        </div>

        {/* Step 1: Create Game */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Gift size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideStep1Title')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideStep1Desc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('guideStep1Details')}</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideStep1Item1')}</li>
              <li>{t('guideStep1Item2')}</li>
              <li>{t('guideStep1Item3')}</li>
              <li>{t('guideStep1Item4')}</li>
            </ul>
          </div>
        </Card>

        {/* Step 2: Add Participants */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Users size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideStep2Title')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideStep2Desc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('guideStep2Details')}</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideStep2Item1')}</li>
              <li>{t('guideStep2Item2')}</li>
              <li>{t('guideStep2Item3')}</li>
            </ul>
          </div>
        </Card>

        {/* Step 3: Configure Options */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Gear size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideStep3Title')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideStep3Desc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>{t('guideStep3Option1')}</strong> - {t('guideStep3Option1Desc')}</li>
              <li><strong>{t('guideStep3Option2')}</strong> - {t('guideStep3Option2Desc')}</li>
              <li><strong>{t('guideStep3Option3')}</strong> - {t('guideStep3Option3Desc')}</li>
            </ul>
          </div>
        </Card>

        {/* Step 4: Share Links */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <PaperPlaneTilt size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold">{t('guideStep4Title')}</h2>
          </div>
          <p className="text-muted-foreground">{t('guideStep4Desc')}</p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('guideStep4Item1')}</li>
              <li>{t('guideStep4Item2')}</li>
              <li>{t('guideStep4Item3')}</li>
            </ul>
          </div>
        </Card>

        <Separator />

        {/* Organizer Panel Features */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center">{t('guideOrganizerPanelTitle')}</h2>
          <p className="text-center text-muted-foreground">{t('guideOrganizerPanelDesc')}</p>
        </div>

        {/* Statistics */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
              <ChartBar size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureStats')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureStatsDesc')}</p>
        </Card>

        {/* Manage Participants */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
              <UserCirclePlus size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureManage')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureManageDesc')}</p>
        </Card>

        {/* Reassignment Requests */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
              <ArrowsClockwise size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureReassign')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureReassignDesc')}</p>
        </Card>

        {/* Regenerate Links */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
              <LinkIcon size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureLinks')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureLinksDesc')}</p>
        </Card>

        {/* Regenerate Organizer Token */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-full">
              <Key size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureOrganizerToken')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureOrganizerTokenDesc')}</p>
        </Card>

        {/* Delete Game */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
              <Trash size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold">{t('guideFeatureDelete')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('guideFeatureDeleteDesc')}</p>
        </Card>

        {/* Tips */}
        <Card className="p-6 space-y-4 border-primary/20 bg-primary/5">
          <h3 className="text-lg font-semibold text-primary">{t('guideTipsTitle')}</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
            <li>{t('guideTip1')}</li>
            <li>{t('guideTip2')}</li>
            <li>{t('guideTip3')}</li>
            <li>{t('guideTip4')}</li>
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
