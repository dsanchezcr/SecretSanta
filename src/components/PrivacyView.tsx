import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, ShieldCheck, Database, Lock, Trash, Globe } from '@phosphor-icons/react'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'
import { motion } from 'framer-motion'
import { hasAnalyticsConsent, setAnalyticsConsent, setAnalyticsDeclined } from '@/lib/analytics'
import { toast } from 'sonner'

interface PrivacyViewProps {
  onBack: () => void
}

export function PrivacyView({ onBack }: PrivacyViewProps) {
  const { t } = useLanguage()
  const [analyticsConsent, setAnalyticsConsentState] = useState(hasAnalyticsConsent())

  const handleConsentChange = (consent: boolean) => {
    if (consent) {
      setAnalyticsConsent(true)
      setAnalyticsConsentState(true)
      toast.success(t('analyticsEnabled') || 'Analytics enabled')
    } else {
      setAnalyticsDeclined()
      setAnalyticsConsentState(false)
      toast.success(t('analyticsDisabled') || 'Analytics disabled')
    }
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

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-3 rounded-full shrink-0">
                <ShieldCheck size={32} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-primary">
                  {t('privacyTitle')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('privacySubtitle')}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Data Collection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Database size={20} className="text-primary" />
              {t('privacyDataCollectionTitle')}
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>{t('privacyDataCollectionDesc')}</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{t('privacyDataItem1')}</li>
                <li>{t('privacyDataItem2')}</li>
                <li>{t('privacyDataItem3')}</li>
                <li>{t('privacyDataItem4')}</li>
              </ul>
            </div>
          </Card>
        </motion.div>

        {/* Data Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Lock size={20} className="text-primary" />
              {t('privacyDataUsageTitle')}
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>{t('privacyDataUsageDesc')}</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-green-800 font-medium">
                  ✅ {t('privacyDataUsagePromise')}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Data Retention */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Trash size={20} className="text-primary" />
              {t('privacyDataRetentionTitle')}
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>{t('privacyDataRetentionDesc')}</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{t('privacyDataRetentionItem1')}</li>
                <li>{t('privacyDataRetentionItem2')}</li>
              </ul>
            </div>
          </Card>
        </motion.div>

        {/* Third Parties */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Globe size={20} className="text-primary" />
              {t('privacyThirdPartiesTitle')}
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>{t('privacyThirdPartiesDesc')}</p>
            </div>
          </Card>
        </motion.div>

        {/* Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <ShieldCheck size={20} className="text-primary" />
              {t('privacyAnalyticsTitle')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('privacyAnalyticsDesc')}</p>
              
              {/* Consent Management UI */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {t('analyticsConsentStatus') || 'Analytics Status'}
                    </p>
                    <p className="text-sm">
                      {analyticsConsent 
                        ? (t('analyticsCurrentlyEnabled') || 'Analytics are currently enabled')
                        : (t('analyticsCurrentlyDisabled') || 'Analytics are currently disabled')
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!analyticsConsent && (
                    <Button
                      size="sm"
                      onClick={() => handleConsentChange(true)}
                      className="flex-1 sm:flex-none"
                    >
                      {t('enableAnalytics') || 'Enable Analytics'}
                    </Button>
                  )}
                  {analyticsConsent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConsentChange(false)}
                      className="flex-1 sm:flex-none"
                    >
                      {t('disableAnalytics') || 'Disable Analytics'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 bg-muted/50">
            <p className="text-sm text-muted-foreground text-center">
              {t('privacyLastUpdated')}: {new Date().toLocaleDateString()}
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
