import { useState, useEffect, ReactNode, useCallback } from 'react'
import { Language, LANGUAGES } from '@/lib/types'
import { translations, TranslationKey } from '@/lib/translations'
import { LanguageContext } from './LanguageProvider.context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // First check URL parameter
    const params = new URLSearchParams(window.location.search)
    const urlLang = params.get('lang')
    if (urlLang && LANGUAGES.some(l => l.code === urlLang)) {
      return urlLang as Language
    }
    
    // Then check localStorage
    const saved = localStorage.getItem('language')
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      return saved as Language
    }
    
    // Default to English
    return 'en'
  })

  // Update URL when language changes (without causing navigation)
  const updateUrlLanguage = useCallback((lang: Language) => {
    const url = new URL(window.location.href)
    url.searchParams.set('lang', lang)
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Wrapper to set language and update URL
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    updateUrlLanguage(lang)
  }, [updateUrlLanguage])

  // Save to localStorage and update URL when language changes
  useEffect(() => {
    localStorage.setItem('language', language)
    // Only update URL if lang param is missing or different
    const params = new URLSearchParams(window.location.search)
    const urlLang = params.get('lang')
    if (urlLang !== language) {
      updateUrlLanguage(language)
    }
  }, [language, updateUrlLanguage])

  // Listen for URL changes (e.g., browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const urlLang = params.get('lang')
      if (urlLang && LANGUAGES.some(l => l.code === urlLang) && urlLang !== language) {
        setLanguageState(urlLang as Language)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [language])

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
