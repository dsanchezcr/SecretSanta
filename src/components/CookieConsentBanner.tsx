import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/useLanguage'
import { hasAnalyticsConsent, hasDeclinedAnalytics, setAnalyticsConsent, setAnalyticsDeclined } from '@/lib/analytics'

/**
 * Cookie consent banner for GDPR compliance
 * Shows on first visit, allows users to accept or decline analytics
 */
export function CookieConsentBanner() {
  const { t } = useLanguage()
  const [isVisible, setIsVisible] = useState(() => {
    // Check if user has already made a choice
    return !hasAnalyticsConsent() && !hasDeclinedAnalytics()
  })

  const handleAccept = () => {
    setAnalyticsConsent(true)
    setIsVisible(false)
  }

  const handleDecline = () => {
    setAnalyticsDeclined()
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 shadow-lg"
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 id="cookie-consent-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('cookieConsentTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('cookieConsentDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              className="flex-1 sm:flex-none"
            >
              {t('cookieConsentDecline')}
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1 sm:flex-none"
            >
              {t('cookieConsentAccept')}
            </Button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDecline}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        aria-label="Close"
      >
        <X size={20} />
      </button>
    </div>
  )
}
