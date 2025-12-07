import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider } from '@/components/LanguageProvider'
import { useLanguage } from '@/components/useLanguage'
import { HomeView } from '@/components/HomeView'
import { CreateGameView } from '@/components/CreateGameView'
import { GameCreatedView } from '@/components/GameCreatedView'
import { ParticipantSelectionView } from '@/components/ParticipantSelectionView'
import { AssignmentView } from '@/components/AssignmentView'
import { OrganizerPanelView } from '@/components/OrganizerPanelView'
import { PrivacyView } from '@/components/PrivacyView'
import { GameNotFoundView } from '@/components/GameNotFoundView'
import { ErrorView, type ErrorType } from '@/components/ErrorView'
import { OrganizerGuideView } from '@/components/OrganizerGuideView'
import { ParticipantGuideView } from '@/components/ParticipantGuideView'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { LoadingView } from '@/components/LoadingView'
import { Game, Participant } from '@/lib/types'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { checkApiStatus, getGameAPI, CreateGameResponse } from '@/lib/api'
import { initializeAnalytics } from '@/lib/analytics'

// API health check configuration for initial load
const INITIAL_CHECK_RETRIES = 2
const INITIAL_CHECK_RETRY_DELAY = 1000 // ms

type View =
  | 'home'
  | 'create-game'
  | 'game-created'
  | 'select-participant'
  | 'assignment'
  | 'organizer-panel'
  | 'privacy'
  | 'game-not-found'
  | 'error'
  | 'organizer-guide'
  | 'participant-guide'

type BannerType = 'none' | 'api-unavailable' | 'database-unavailable'

function StatusBanner({ bannerType, isCheckingApi }: { bannerType: BannerType; isCheckingApi: boolean }) {
  const { t } = useLanguage()
  
  // Don't show banner while still checking API status on initial load
  if (isCheckingApi || bannerType === 'none') return null
  
  const isApiUnavailable = bannerType === 'api-unavailable'
  
  return (
    <div className={`px-4 py-2 text-center text-sm font-medium ${
      isApiUnavailable 
        ? 'bg-red-500/90 text-white' 
        : 'bg-amber-500/90 text-amber-950'
    }`}>
      <span className="font-bold">
        {isApiUnavailable ? t('apiUnavailableWarning') : t('databaseUnavailableWarning')}
      </span>
      <span className="hidden sm:inline"> - </span>
      <span className="block sm:inline">
        {isApiUnavailable ? t('apiUnavailableDesc') : t('databaseUnavailableDesc')}
      </span>
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [games, setGames] = useLocalStorage<Record<string, Game>>('games', {})
  const [currentGameCode, setCurrentGameCode] = useState<string>('')
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [bannerType, setBannerType] = useState<BannerType>('none')
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [emailResults, setEmailResults] = useState<CreateGameResponse['emailResults'] | undefined>(undefined)
  const [errorType, setErrorType] = useState<ErrorType | null>(null)
  const [isLoadingGame, setIsLoadingGame] = useState(false)
  const [isCheckingApi, setIsCheckingApi] = useState(true)
  const initialUrlHandled = useRef(false)
  const initialCheckDone = useRef(false)

  // Check API status on mount
  useEffect(() => {
    const checkStatus = async (isInitialCheck = false) => {
      if (isInitialCheck) {
        setIsCheckingApi(true)
      }
      
      try {
        // On initial load, use retries to handle cold starts (especially after deployments)
        const status = isInitialCheck 
          ? await checkApiStatus(INITIAL_CHECK_RETRIES, INITIAL_CHECK_RETRY_DELAY) 
          : await checkApiStatus()
        
        if (!status.available) {
          setBannerType('api-unavailable')
          setEmailConfigured(false)
        } else if (!status.databaseConnected) {
          setBannerType('database-unavailable')
          setEmailConfigured(status.emailConfigured)
        } else {
          setBannerType('none')
          setEmailConfigured(status.emailConfigured)
        }
      } finally {
        if (isInitialCheck) {
          setIsCheckingApi(false)
        }
      }
    }
    
    // Initial check with retries
    // Set flag before check to ensure retries only happen once, even in React strict mode
    if (!initialCheckDone.current) {
      initialCheckDone.current = true
      checkStatus(true)
    }
    
    // Initialize Google Analytics if user has consented
    initializeAnalytics()
    
    // Re-check every 30 seconds (without retries)
    const interval = setInterval(() => checkStatus(false), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateGame = () => {
    setView('create-game')
  }

  const handleGameCreated = (game: Game, results?: CreateGameResponse['emailResults']) => {
    setGames((currentGames) => ({
      ...currentGames,
      [game.code]: game
    }))
    setCurrentGameCode(game.code)
    setEmailResults(results)
    setView('game-created')
  }

  const handleJoinGame = useCallback(async (code: string, participantToken?: string) => {
    setIsLoadingGame(true)
    
    try {
      // Check if we have a stored participant token in sessionStorage for this game
      const storedToken = participantToken || sessionStorage.getItem(`participant-token-${code}`)
      
      // First check local storage for complete game data (must have participants array)
      if (games && games[code] && games[code].participants && games[code].participants.length > 0) {
        const game = games[code]
        
        // If participant token is provided, verify and auto-redirect to assignment
        if (storedToken) {
          const participant = game.participants.find(p => p.token === storedToken)
          if (participant) {
            // Store token in sessionStorage for persistence across reloads
            sessionStorage.setItem(`participant-token-${code}`, storedToken)
            setCurrentGameCode(code)
            setCurrentParticipant(participant)
            setView('assignment')
            return
          }
          // Token provided but doesn't match any participant - fetch from API to validate
          // Don't immediately show error, as the local cache might be stale
        }
        
        // For protected games without token, show message
        if (game.isProtected && !storedToken) {
          setCurrentGameCode(code)
          setErrorType('protected-game')
          setView('error')
          return
        }
        
        // For unprotected games (or if token didn't match local cache), go to participant selection
        if (!game.isProtected) {
          setCurrentGameCode(code)
          setView('select-participant')
          return
        }
        
        // If we get here, it's a protected game with a token that didn't match local cache
        // Fall through to fetch from API to validate the token
      }
      
      // Fetch from API - either game not in local storage, or need to validate token
      try {
        const game = await getGameAPI(code, { participantToken: storedToken || undefined })
        
        // Type assertion for additional API response fields
        const gameResponse = game as Game & { requiresToken?: boolean; authenticatedParticipantId?: string; giverHasConfirmed?: boolean }
        
        // Check if game requires token (protected game without valid token)
        if (gameResponse.requiresToken) {
          setCurrentGameCode(code)
          setErrorType('protected-game')
          setView('error')
          return
        }
        
        // Only save to local storage if we have the full game data (with participants)
        if (game.participants && game.participants.length > 0) {
          setGames((currentGames) => ({
            ...currentGames,
            [game.code]: game // Store the game object (without extra response fields)
          }))
        }
        
        // If authenticated participant ID is returned, auto-redirect to assignment
        if (gameResponse.authenticatedParticipantId && game.participants) {
          const participant = game.participants.find(p => p.id === gameResponse.authenticatedParticipantId)
          if (participant) {
            // Store token in sessionStorage for persistence across reloads
            if (storedToken) {
              sessionStorage.setItem(`participant-token-${game.code}`, storedToken)
            }
            setCurrentGameCode(game.code)
            setCurrentParticipant(participant)
            setView('assignment')
            return
          }
        }
        
        // Ensure game has participants before navigating to select-participant
        if (!game.participants || game.participants.length === 0) {
          // Game data is incomplete, show error
          setCurrentGameCode(code)
          setErrorType('protected-game')
          setView('error')
          return
        }
        
        setCurrentGameCode(game.code)
        setView('select-participant')
      } catch {
        setView('game-not-found')
        return
      }
    } finally {
      setIsLoadingGame(false)
    }
  }, [games, setGames])

  const handleOrganizerAccess = useCallback(async (gameCode: string, organizerToken: string) => {
    setIsLoadingGame(true)
    
    try {
      // First, check local storage for the game
      if (games && games[gameCode]) {
        const game = games[gameCode]
        // Validate that the token matches this specific game
        if (game.organizerToken === organizerToken) {
          setCurrentGameCode(gameCode)
          setView('organizer-panel')
          return
        }
        // Token doesn't match local storage - could be stale, try fetching from API
      }
      
      // Fetch from API with organizerToken for validation
      try {
        const game = await getGameAPI(gameCode, { organizerToken })
        // If API returns the game with matching organizerToken, access is valid
        if (game.organizerToken === organizerToken) {
          setGames((currentGames) => ({
            ...currentGames,
            [game.code]: game
          }))
          setCurrentGameCode(game.code)
          setView('organizer-panel')
        } else {
          setView('game-not-found')
        }
      } catch {
        setView('game-not-found')
      }
    } finally {
      setIsLoadingGame(false)
    }
  }, [games, setGames])

  // Handle URL parameters for game code, organizer access, and direct views
  useEffect(() => {
    // Only handle URL once on mount
    if (initialUrlHandled.current) {
      return
    }
    initialUrlHandled.current = true
    
    const params = new URLSearchParams(window.location.search)
    const pathname = window.location.pathname
    const code = params.get('code')
    const organizerParam = params.get('organizer')
    const participantParam = params.get('participant')
    const viewParam = params.get('view')

    // Handle path-based navigation (for shareable guide links)
    if (pathname === '/organizer-guide') {
      setTimeout(() => setView('organizer-guide'), 0)
      return
    }
    if (pathname === '/participant-guide') {
      setTimeout(() => setView('participant-guide'), 0)
      return
    }
    if (pathname === '/privacy') {
      setTimeout(() => setView('privacy'), 0)
      return
    }

    // Handle query param navigation (legacy support)
    if (viewParam === 'organizer-guide') {
      setTimeout(() => setView('organizer-guide'), 0)
      return
    }
    if (viewParam === 'participant-guide') {
      setTimeout(() => setView('participant-guide'), 0)
      return
    }
    if (viewParam === 'privacy') {
      setTimeout(() => setView('privacy'), 0)
      return
    }

    // If both code and organizer token are present, it's an organizer access
    if (code && organizerParam) {
      setTimeout(() => handleOrganizerAccess(code, organizerParam), 0)
    } else if (code && participantParam) {
      // Participant with unique token - direct access to their assignment
      setTimeout(() => handleJoinGame(code, participantParam), 0)
    } else if (code) {
      setTimeout(() => handleJoinGame(code), 0)
    }
  }, [handleJoinGame, handleOrganizerAccess])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname
      const params = new URLSearchParams(window.location.search)
      const viewParam = params.get('view')
      
      // Path-based routes
      if (pathname === '/organizer-guide') {
        setView('organizer-guide')
        return
      }
      if (pathname === '/participant-guide') {
        setView('participant-guide')
        return
      }
      if (pathname === '/privacy') {
        setView('privacy')
        return
      }
      
      // Query param routes (legacy)
      if (viewParam === 'organizer-guide') {
        setView('organizer-guide')
        return
      }
      if (viewParam === 'participant-guide') {
        setView('participant-guide')
        return
      }
      if (viewParam === 'privacy') {
        setView('privacy')
        return
      }
      
      // Default to home if no special route
      if (pathname === '/' && !params.get('code')) {
        setView('home')
        setCurrentGameCode('')
        setCurrentParticipant(null)
        setErrorType(null)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Restore participant session from sessionStorage if available
  useEffect(() => {
    // Only restore if no URL parameters are present (to avoid conflicts)
    const params = new URLSearchParams(window.location.search)
    if (params.get('code') || params.get('organizer') || params.get('participant')) {
      return
    }

    // Check if there's a stored participant session
    const keys = Object.keys(sessionStorage)
    const participantTokenKey = keys.find(k => k.startsWith('participant-token-'))
    
    if (participantTokenKey) {
      const code = participantTokenKey.replace('participant-token-', '')
      const token = sessionStorage.getItem(participantTokenKey)
      if (code && token && games && games[code]) {
        // Restore the participant session
        setTimeout(() => handleJoinGame(code, token), 0)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleParticipantSelected = (participant: Participant) => {
    setCurrentParticipant(participant)
    setView('assignment')
  }

  const handleUpdateGame = (updatedGame: Game) => {
    setGames((currentGames) => ({
      ...(currentGames || {}),
      [updatedGame.code]: updatedGame
    }))
    
    if (currentParticipant && updatedGame.participants) {
      const updatedParticipant = updatedGame.participants.find(p => p.id === currentParticipant.id)
      if (updatedParticipant) {
        setCurrentParticipant(updatedParticipant)
      }
    }
  }

  const handleBack = () => {
    setView('home')
    setCurrentGameCode('')
    setCurrentParticipant(null)
    setErrorType(null)
    // Navigate back to root path but preserve language
    const params = new URLSearchParams(window.location.search)
    const lang = params.get('lang')
    const newUrl = lang ? `/?lang=${lang}` : '/'
    window.history.pushState({}, '', newUrl)
  }

  const handleGameDeleted = () => {
    // Remove from local storage
    if (currentGameCode && games) {
      const newGames = { ...games }
      delete newGames[currentGameCode]
      setGames(newGames)
    }
    setCurrentGameCode('')
    setCurrentParticipant(null)
    setErrorType(null)
    setView('home')
    // Clear URL parameters
    window.history.replaceState({}, '', window.location.pathname)
  }

  const handlePrivacy = () => {
    const params = new URLSearchParams(window.location.search)
    const lang = params.get('lang')
    const url = lang ? `/privacy?lang=${lang}` : '/privacy'
    window.history.pushState({}, '', url)
    setView('privacy')
  }

  const handleTokenSubmit = useCallback((token: string) => {
    if (currentGameCode && token) {
      // Clear previous error state
      setErrorType(null)
      // Try to join the game with the new token
      handleJoinGame(currentGameCode, token)
    }
  }, [currentGameCode, handleJoinGame])

  const currentGame = games?.[currentGameCode]

  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col">
        <StatusBanner bannerType={bannerType} isCheckingApi={isCheckingApi} />
        <div className="flex-1">
          {isLoadingGame && <LoadingView />}
          
          {!isLoadingGame && view === 'home' && (
            <HomeView 
              onCreateGame={handleCreateGame} 
              onJoinGame={handleJoinGame} 
              onPrivacy={handlePrivacy}
              onOrganizerGuide={() => {
                const params = new URLSearchParams(window.location.search)
                const lang = params.get('lang')
                const url = lang ? `/organizer-guide?lang=${lang}` : '/organizer-guide'
                window.history.pushState({}, '', url)
                setView('organizer-guide')
              }}
              onParticipantGuide={() => {
                const params = new URLSearchParams(window.location.search)
                const lang = params.get('lang')
                const url = lang ? `/participant-guide?lang=${lang}` : '/participant-guide'
                window.history.pushState({}, '', url)
                setView('participant-guide')
              }}
            />
          )}

          {!isLoadingGame && view === 'create-game' && (
            <CreateGameView onGameCreated={handleGameCreated} onBack={handleBack} emailConfigured={emailConfigured} />
          )}

          {!isLoadingGame && view === 'game-created' && currentGame && (
            <GameCreatedView 
              game={currentGame} 
              onContinue={() => setView('organizer-panel')}
              emailResults={emailResults}
            />
          )}

          {!isLoadingGame && view === 'select-participant' && currentGame && (
            <ParticipantSelectionView
              game={currentGame}
              onParticipantSelected={handleParticipantSelected}
              onUpdateGame={handleUpdateGame}
              onBack={handleBack}
              emailConfigured={emailConfigured}
            />
          )}

          {!isLoadingGame && view === 'assignment' && currentGame && currentParticipant && (
            <AssignmentView
              game={currentGame}
              participant={currentParticipant}
              onUpdateGame={handleUpdateGame}
              onBack={handleBack}
              emailConfigured={emailConfigured}
            />
          )}

          {!isLoadingGame && view === 'organizer-panel' && currentGame && (
            <OrganizerPanelView
              game={currentGame}
              onUpdateGame={handleUpdateGame}
              onBack={handleBack}
              onGameDeleted={handleGameDeleted}
            />
          )}

          {!isLoadingGame && view === 'privacy' && (
            <PrivacyView onBack={handleBack} />
          )}

          {!isLoadingGame && view === 'game-not-found' && (
            <GameNotFoundView onGoHome={handleBack} />
          )}

          {!isLoadingGame && view === 'error' && errorType && (
            <ErrorView 
              errorType={errorType} 
              gameCode={currentGameCode} 
              onGoHome={handleBack} 
              onSubmitToken={handleTokenSubmit}
              emailConfigured={emailConfigured}
            />
          )}

          {!isLoadingGame && view === 'organizer-guide' && (
            <OrganizerGuideView onBack={handleBack} />
          )}

          {!isLoadingGame && view === 'participant-guide' && (
            <ParticipantGuideView onBack={handleBack} />
          )}
        </div>
        <Toaster position="top-center" />
        <CookieConsentBanner />
      </div>
    </LanguageProvider>
  )
}

export default App