import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Users,
  Shuffle,
  Trash,
  UserPlus,
  Gift,
  CalendarBlank,
  MapPin,
  CurrencyDollar,
  Note,
  ShieldCheck,
  PencilSimple,
  Copy,
  Check,
  X,
  Warning,
  CircleNotch,
  Heart,
  Clock,
  CheckCircle,
  XCircle,
  Envelope,
  ArrowsClockwise,
  Bell,
  PaperPlaneTilt,
  Key,
  Download,
} from '@phosphor-icons/react'
import { Game, Participant } from '@/lib/types'
import { useLanguage } from './useLanguage'
import { LanguageToggle } from './LanguageToggle'
import { formatDate, copyToClipboard, buildShareableUrl, isValidDate } from '@/lib/game-utils'
import { formatAmount } from '@/lib/currency-utils'
import { isValidEmail } from '@/lib/utils'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { 
  updateGameDetailsAPI, 
  addParticipantAPI, 
  removeParticipantAPI,
  approveReassignmentAPI,
  approveAllReassignmentsAPI,
  reassignAllAPI,
  cancelReassignmentRequestAPI,
  checkApiStatus,
  updateParticipantDetailsAPI,
  getGameAPI,
  sendReminderEmailAPI,
  sendReminderToAllAPI,
  deleteGameAPI,
  regenerateParticipantTokenAPI,
  regenerateOrganizerTokenAPI
} from '@/lib/api'
import {
  addParticipantLocal,
  removeParticipantLocal,
  approveReassignmentLocal,
  approveAllReassignmentsLocal,
  reassignAllLocal,
  cancelReassignmentRequestLocal,
  regenerateParticipantTokenLocal
} from '@/lib/local-game-operations'

interface OrganizerPanelViewProps {
  game: Game
  onUpdateGame: (game: Game) => void
  onBack: () => void
  onGameDeleted?: () => void
}

export function OrganizerPanelView({ game, onUpdateGame, onBack, onGameDeleted }: OrganizerPanelViewProps) {
  const { t, language } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)
  const [isRemovingParticipant, setIsRemovingParticipant] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null)
  const [newParticipantName, setNewParticipantName] = useState('')
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [showReassignAllDialog, setShowReassignAllDialog] = useState(false)
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false)
  const [isApprovingReassignment, setIsApprovingReassignment] = useState<string | null>(null)
  const [isApprovingAllReassignments, setIsApprovingAllReassignments] = useState(false)
  const [isCancellingRequest, setIsCancellingRequest] = useState<string | null>(null)
  const [isReassigningAll, setIsReassigningAll] = useState(false)
  const [participantToReassign, setParticipantToReassign] = useState<string | null>(null)
  const [newParticipantEmail, setNewParticipantEmail] = useState('')
  
  // Email configuration state
  const [emailConfigured, setEmailConfigured] = useState(false)
  
  // Delete game state
  const [showDeleteGameDialog, setShowDeleteGameDialog] = useState(false)
  const [isDeletingGame, setIsDeletingGame] = useState(false)
  
  // Regenerate organizer token state
  const [showRegenerateOrganizerTokenDialog, setShowRegenerateOrganizerTokenDialog] = useState(false)
  const [isRegeneratingOrganizerToken, setIsRegeneratingOrganizerToken] = useState(false)
  
  // Regenerate token state
  const [showRegenerateTokenDialog, setShowRegenerateTokenDialog] = useState(false)
  const [participantToRegenerateToken, setParticipantToRegenerateToken] = useState<Participant | null>(null)
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false)
  const [generatedNewToken, setGeneratedNewToken] = useState(false)
  const [newParticipantLink, setNewParticipantLink] = useState('')
  // Edit participant state
  const [showEditParticipantDialog, setShowEditParticipantDialog] = useState(false)
  const [participantToEdit, setParticipantToEdit] = useState<Participant | null>(null)
  const [editParticipantName, setEditParticipantName] = useState('')
  const [editParticipantEmail, setEditParticipantEmail] = useState('')
  const [editParticipantDesiredGift, setEditParticipantDesiredGift] = useState('')
  const [editParticipantWish, setEditParticipantWish] = useState('')
  const [editParticipantConfirmed, setEditParticipantConfirmed] = useState(false)
  const [isSavingParticipant, setIsSavingParticipant] = useState(false)
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Reminder email state
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [participantToRemind, setParticipantToRemind] = useState<Participant | null>(null)
  const [reminderMessage, setReminderMessage] = useState('')
  const [isSendingReminder, setIsSendingReminder] = useState(false)
  const [isSendingReminderAll, setIsSendingReminderAll] = useState(false)
  
  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportIncludeAssignments, setExportIncludeAssignments] = useState(true)
  const [exportIncludeGameDetails, setExportIncludeGameDetails] = useState(true)
  const [exportIncludeWishes, setExportIncludeWishes] = useState(true)
  const [exportIncludeInstructions, setExportIncludeInstructions] = useState(true)
  const [exportIncludeConfirmationStatus, setExportIncludeConfirmationStatus] = useState(true)
  const [exportIncludeEmails, setExportIncludeEmails] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  
  // Refs for input focus management
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  // Edit form state
  const [editName, setEditName] = useState(game.name)
  const [editAmount, setEditAmount] = useState(game.amount)
  const [editCurrency, setEditCurrency] = useState(game.currency)
  const [editDate, setEditDate] = useState(game.date)
  const [editTime, setEditTime] = useState(game.time || '')
  const [editLocation, setEditLocation] = useState(game.location)
  const [editNotes, setEditNotes] = useState(game.generalNotes)
  const [editAllowReassignment, setEditAllowReassignment] = useState(game.allowReassignment)

  // Stats
  const confirmedCount = game.participants.filter(p => p.hasConfirmedAssignment).length
  // Count participants who have either wish or desiredGift set
  const wishCount = game.participants.filter(p => (p.wish && p.wish.trim() !== '') || (p.desiredGift && p.desiredGift.trim() !== '')).length
  const pendingRequestsCount = game.reassignmentRequests?.length || 0
  const totalParticipants = game.participants.length

  // Generate participant link with language for consistent experience
  const getParticipantLink = (participant: Participant) => {
    if (game.isProtected && participant.token) {
      return buildShareableUrl({ code: game.code, participant: participant.token, lang: language })
    }
    return buildShareableUrl({ code: game.code, lang: language })
  }

  const handleCopyParticipantLink = async (participant: Participant) => {
    try {
      await copyToClipboard(getParticipantLink(participant))
      toast.success(t('participantLinkCopied'))
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleCopySharedParticipantLink = async () => {
    try {
      await copyToClipboard(buildShareableUrl({ code: game.code, lang: language }))
      toast.success(t('participantLinkCopied'))
    } catch {
      toast.error('Failed to copy link')
    }
  }

  // Refresh game data from API
  const refreshGameData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        const freshGame = await getGameAPI(game.code, { organizerToken: game.organizerToken })
        onUpdateGame(freshGame)
        toast.success(t('dataRefreshed'))
      } else {
        toast.error(t('apiUnavailable'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to refresh data'
      toast.error(message)
    } finally {
      setIsRefreshing(false)
    }
  }, [game.code, game.organizerToken, onUpdateGame, t])

  // Refresh data on mount to ensure consistency
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        const apiStatus = await checkApiStatus()
        if (apiStatus.available && apiStatus.databaseConnected) {
          const freshGame = await getGameAPI(game.code, { organizerToken: game.organizerToken })
          onUpdateGame(freshGame)
        }
        // Set email configuration status
        setEmailConfigured(apiStatus.emailConfigured)
      } catch {
        // Silently fail on mount - we'll use cached data
        setEmailConfigured(false)
      }
    }
    refreshOnMount()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Get receiver name for a participant
  const getReceiverName = (participantId: string): string => {
    const assignment = game.assignments.find(a => a.giverId === participantId)
    if (assignment) {
      const receiver = game.participants.find(p => p.id === assignment.receiverId)
      return receiver?.name || ''
    }
    return ''
  }

  // Save game edits
  const handleSaveChanges = async () => {
    // Validate date before saving
    if (editDate && !isValidDate(editDate)) {
      toast.error(t('invalidDate'))
      return
    }
    
    setIsSaving(true)
    try {
      // Try API first
      const apiStatus = await checkApiStatus()
      if (apiStatus.available) {
        const updatedGame = await updateGameDetailsAPI(game.code, game.organizerToken, {
          name: editName,
          amount: editAmount,
          currency: editCurrency,
          date: editDate,
          time: editTime || undefined,
          location: editLocation,
          generalNotes: editNotes,
          allowReassignment: editAllowReassignment,
        })
        onUpdateGame(updatedGame)
      } else {
        // Fallback to local storage only
        const updatedGame: Game = {
          ...game,
          name: editName,
          amount: editAmount,
          currency: editCurrency,
          date: editDate,
          time: editTime || undefined,
          location: editLocation,
          generalNotes: editNotes,
          allowReassignment: editAllowReassignment,
        }
        onUpdateGame(updatedGame)
      }
      setIsEditing(false)
      toast.success(t('gameUpdated'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save changes'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditName(game.name)
    setEditAmount(game.amount)
    setEditCurrency(game.currency)
    setEditDate(game.date)
    setEditTime(game.time || '')
    setEditLocation(game.location)
    setEditNotes(game.generalNotes)
    setEditAllowReassignment(game.allowReassignment)
    setIsEditing(false)
  }

  // Add new participant
  const handleAddParticipant = async () => {
    const name = newParticipantName.trim()
    const email = newParticipantEmail.trim() || undefined
    if (!name) return

    // Check for duplicate names
    if (game.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t('participantNameExists'))
      return
    }

    // Validate email format
    if (email && !isValidEmail(email)) {
      toast.error(t('invalidEmailFormat'))
      return
    }

    // Check for duplicate emails (case-insensitive)
    if (email && game.participants.some(p => p.email?.toLowerCase() === email.toLowerCase())) {
      toast.error(t('emailAlreadyExists'))
      return
    }

    setIsAddingParticipant(true)
    try {
      // Try API first
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await addParticipantAPI(game.code, game.organizerToken, name, email)
          onUpdateGame(updatedGame)
        } catch {
          // API call failed - fall back to local operation
          const updatedGame = addParticipantLocal(game, name, email)
          onUpdateGame(updatedGame)
        }
      } else {
        // API not available - use local operation
        const updatedGame = addParticipantLocal(game, name, email)
        onUpdateGame(updatedGame)
      }
      setNewParticipantName('')
      setNewParticipantEmail('')
      toast.success(t('participantAdded'))
      // Focus back on name input
      setTimeout(() => nameInputRef.current?.focus(), 0)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add participant'
      toast.error(message)
    } finally {
      setIsAddingParticipant(false)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && newParticipantName.trim()) {
      e.preventDefault()
      emailInputRef.current?.focus()
    } else if (e.key === 'Enter' && newParticipantName.trim()) {
      e.preventDefault()
      handleAddParticipant()
    }
  }

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'Enter') && newParticipantName.trim()) {
      e.preventDefault()
      handleAddParticipant()
    }
  }

  // Confirm remove participant
  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return

    setIsRemovingParticipant(true)
    try {
      // Try API first
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await removeParticipantAPI(
            game.code, 
            game.organizerToken, 
            participantToRemove.id
          )
          onUpdateGame(updatedGame)
        } catch {
          // API call failed - fall back to local operation
          const updatedGame = removeParticipantLocal(game, participantToRemove.id)
          onUpdateGame(updatedGame)
        }
      } else {
        // API not available - use local operation
        const updatedGame = removeParticipantLocal(game, participantToRemove.id)
        onUpdateGame(updatedGame)
      }
      setShowRemoveDialog(false)
      setParticipantToRemove(null)
      toast.success(t('participantRemoved'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove participant'
      toast.error(message)
    } finally {
      setIsRemovingParticipant(false)
    }
  }

  // Open remove dialog
  const openRemoveDialog = (participant: Participant) => {
    setParticipantToRemove(participant)
    setShowRemoveDialog(true)
  }

  // Handle approve reassignment
  const handleApproveReassignment = async (participantId: string) => {
    setIsApprovingReassignment(participantId)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await approveReassignmentAPI(game.code, game.organizerToken, participantId)
          onUpdateGame(updatedGame)
          toast.success(t('reassignmentApproved'))
        } catch {
          // API call failed - fall back to local operation
          try {
            const updatedGame = approveReassignmentLocal(game, participantId)
            onUpdateGame(updatedGame)
            toast.success(t('reassignmentApproved'))
          } catch (localError: unknown) {
            const message = localError instanceof Error ? localError.message : 'Failed to approve reassignment'
            if (message.includes('no valid swap') || message.includes('No valid swap')) {
              toast.error(t('reassignmentFailed'))
            } else {
              toast.error(message)
            }
          }
        }
      } else {
        // API not available - use local operation
        try {
          const updatedGame = approveReassignmentLocal(game, participantId)
          onUpdateGame(updatedGame)
          toast.success(t('reassignmentApproved'))
        } catch (localError: unknown) {
          const message = localError instanceof Error ? localError.message : 'Failed to approve reassignment'
          if (message.includes('no valid swap') || message.includes('No valid swap')) {
            toast.error(t('reassignmentFailed'))
          } else {
            toast.error(message)
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve reassignment'
      // Check if it's a "no valid swap" error and show translated message
      if (message.includes('no valid swap')) {
        toast.error(t('reassignmentFailed'))
      } else {
        toast.error(message)
      }
    } finally {
      setIsApprovingReassignment(null)
      setShowReassignDialog(false)
      setParticipantToReassign(null)
    }
  }

  // Handle cancel reassignment request
  const handleCancelReassignmentRequest = async (participantId: string) => {
    setIsCancellingRequest(participantId)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await cancelReassignmentRequestAPI(game.code, game.organizerToken, participantId)
          onUpdateGame(updatedGame)
        } catch {
          // API call failed - fall back to local operation
          const updatedGame = cancelReassignmentRequestLocal(game, participantId)
          onUpdateGame(updatedGame)
        }
      } else {
        // API not available - use local operation
        const updatedGame = cancelReassignmentRequestLocal(game, participantId)
        onUpdateGame(updatedGame)
      }
      toast.success(t('reassignmentRequestCancelled'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel request'
      toast.error(message)
    } finally {
      setIsCancellingRequest(null)
    }
  }

  // Handle reassign all
  const handleReassignAll = async () => {
    setIsReassigningAll(true)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await reassignAllAPI(game.code, game.organizerToken)
          onUpdateGame(updatedGame)
        } catch {
          // API call failed - fall back to local operation
          const updatedGame = reassignAllLocal(game)
          onUpdateGame(updatedGame)
        }
      } else {
        // API not available - use local operation
        const updatedGame = reassignAllLocal(game)
        onUpdateGame(updatedGame)
      }
      toast.success(t('allReassigned'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reassign all'
      toast.error(message)
    } finally {
      setIsReassigningAll(false)
      setShowReassignAllDialog(false)
    }
  }

  // Handle approve all pending reassignments
  const handleApproveAllReassignments = async () => {
    setIsApprovingAllReassignments(true)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          const updatedGame = await approveAllReassignmentsAPI(game.code, game.organizerToken)
          onUpdateGame(updatedGame)
        } catch {
          // API call failed - fall back to local operation
          const updatedGame = approveAllReassignmentsLocal(game)
          onUpdateGame(updatedGame)
        }
      } else {
        // API not available - use local operation
        const updatedGame = approveAllReassignmentsLocal(game)
        onUpdateGame(updatedGame)
      }
      toast.success(t('allPendingApproved'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve all reassignments'
      // Check if it's a "no valid swap" error and show translated message
      if (message.includes('no valid swap')) {
        toast.error(t('reassignmentFailed'))
      } else {
        toast.error(message)
      }
    } finally {
      setIsApprovingAllReassignments(false)
      setShowApproveAllDialog(false)
    }
  }

  // Open approve reassignment dialog with warning
  const openApproveReassignmentDialog = (participantId: string) => {
    setParticipantToReassign(participantId)
    setShowReassignDialog(true)
  }

  // Open edit participant dialog
  const openEditParticipantDialog = (participant: Participant) => {
    setParticipantToEdit(participant)
    setEditParticipantName(participant.name)
    setEditParticipantEmail(participant.email || '')
    setEditParticipantDesiredGift(participant.desiredGift || '')
    setEditParticipantWish(participant.wish || '')
    setEditParticipantConfirmed(participant.hasConfirmedAssignment || false)
    setShowEditParticipantDialog(true)
  }

  // Save participant edits
  const handleSaveParticipantChanges = async () => {
    if (!participantToEdit) return

    setIsSavingParticipant(true)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available) {
        const updatedGame = await updateParticipantDetailsAPI(
          game.code, 
          game.organizerToken, 
          participantToEdit.id,
          {
            name: editParticipantName.trim(),
            email: editParticipantEmail.trim() || undefined,
            desiredGift: editParticipantDesiredGift.trim() || undefined,
            wish: editParticipantWish.trim() || undefined,
            hasConfirmedAssignment: editParticipantConfirmed
          }
        )
        onUpdateGame(updatedGame)
      } else {
        // Fallback to local update
        const updatedParticipants = game.participants.map(p =>
          p.id === participantToEdit.id
            ? {
                ...p,
                name: editParticipantName.trim(),
                email: editParticipantEmail.trim() || undefined,
                desiredGift: editParticipantDesiredGift.trim() || '',
                wish: editParticipantWish.trim() || '',
                hasConfirmedAssignment: editParticipantConfirmed
              }
            : p
        )
        onUpdateGame({ ...game, participants: updatedParticipants })
      }
      setShowEditParticipantDialog(false)
      setParticipantToEdit(null)
      toast.success(t('participantUpdated'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update participant'
      toast.error(message)
    } finally {
      setIsSavingParticipant(false)
    }
  }

  // Open reminder dialog for a specific participant
  const openReminderDialog = (participant: Participant) => {
    setParticipantToRemind(participant)
    setReminderMessage('')
    setShowReminderDialog(true)
  }

  // Send reminder email to a specific participant
  const handleSendReminder = async () => {
    if (!participantToRemind || !participantToRemind.email) return

    setIsSendingReminder(true)
    try {
      const apiStatus = await checkApiStatus()
      if (!apiStatus.available || !apiStatus.emailConfigured) {
        toast.error(t('emailServiceNotConfigured'))
        return
      }

      const result = await sendReminderEmailAPI(
        game.code,
        game.organizerToken,
        participantToRemind.id,
        language,
        reminderMessage.trim() || undefined
      )

      if (result.success) {
        toast.success(t('reminderSent'))
        setShowReminderDialog(false)
        setParticipantToRemind(null)
        setReminderMessage('')
      } else {
        toast.error(result.message || 'Failed to send reminder')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send reminder'
      toast.error(message)
    } finally {
      setIsSendingReminder(false)
    }
  }

  // Send reminder email to all participants with email
  const handleSendReminderToAll = async () => {
    setIsSendingReminderAll(true)
    try {
      const apiStatus = await checkApiStatus()
      if (!apiStatus.available || !apiStatus.emailConfigured) {
        toast.error(t('emailServiceNotConfigured'))
        return
      }

      const participantsWithEmail = game.participants.filter(p => p.email)
      if (participantsWithEmail.length === 0) {
        toast.error(t('noParticipantsWithEmail'))
        return
      }

      const result = await sendReminderToAllAPI(
        game.code,
        game.organizerToken,
        language,
        reminderMessage.trim() || undefined
      )

      if (result.success) {
        toast.success(`${result.sent} ${t('remindersSent')}${result.failed ? `, ${result.failed} ${t('remindersFailed')}` : ''}`)
        setShowReminderDialog(false)
        setReminderMessage('')
      } else {
        toast.error(result.message || 'Failed to send reminders')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send reminders'
      toast.error(message)
    } finally {
      setIsSendingReminderAll(false)
    }
  }

  // Regenerate participant token handler
  const handleRegenerateParticipantToken = async () => {
    if (!participantToRegenerateToken) return

    setIsRegeneratingToken(true)
    try {
      const apiStatus = await checkApiStatus()
      let updatedGame: Game

      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          updatedGame = await regenerateParticipantTokenAPI(
            game.code,
            game.organizerToken,
            participantToRegenerateToken.id
          )
        } catch {
          // API call failed - fall back to local operation
          updatedGame = regenerateParticipantTokenLocal(game, participantToRegenerateToken.id)
        }
      } else {
        // API not available - use local operation
        updatedGame = regenerateParticipantTokenLocal(game, participantToRegenerateToken.id)
      }

      // Generate new link with updated token
      const updatedParticipant = updatedGame.participants.find(p => p.id === participantToRegenerateToken.id)
      if (updatedParticipant?.token) {
        const newLink = buildShareableUrl({ code: game.code, participant: updatedParticipant.token, lang: language })
        setNewParticipantLink(newLink)
        setGeneratedNewToken(true)
      }

      onUpdateGame(updatedGame)
      toast.success(t('tokenRegenerated'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate token'
      toast.error(message)
    } finally {
      setIsRegeneratingToken(false)
    }
  }

  // Delete game handler
  const handleDeleteGame = async () => {
    setIsDeletingGame(true)
    try {
      const apiStatus = await checkApiStatus()
      if (apiStatus.available && apiStatus.databaseConnected) {
        try {
          await deleteGameAPI(game.code, game.organizerToken)
        } catch {
          // API call failed - still delete locally
          console.warn('API delete failed, deleting locally only')
        }
      }
      // Note: We always complete the delete locally even if API fails
      // This allows offline deletion of games
      toast.success(t('gameDeleted'))
      setShowDeleteGameDialog(false)
      
      // Clear from local storage and navigate back
      if (onGameDeleted) {
        onGameDeleted()
      } else {
        onBack()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete game'
      toast.error(message)
    } finally {
      setIsDeletingGame(false)
    }
  }

  // Regenerate organizer token handler
  const handleRegenerateOrganizerToken = async () => {
    setIsRegeneratingOrganizerToken(true)
    try {
      const apiStatus = await checkApiStatus()
      if (!apiStatus.available || !apiStatus.emailConfigured) {
        toast.error(t('organizerTokenRequiresEmail'))
        return
      }

      const result = await regenerateOrganizerTokenAPI(game.code, game.organizerToken, language)
      
      if (result.success) {
        toast.success(t('organizerTokenRegenerated'))
        setShowRegenerateOrganizerTokenDialog(false)
        
        // After successful regeneration, the current token is invalid
        // Navigate back to home since the user's access is revoked
        setTimeout(() => {
          toast.info(t('checkEmailForNewLink'))
          if (onGameDeleted) {
            onGameDeleted()
          } else {
            onBack()
          }
        }, 1500)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate organizer token'
      toast.error(message)
    } finally {
      setIsRegeneratingOrganizerToken(false)
    }
  }

  // Export participants handler
  const handleExportParticipants = () => {
    setIsExporting(true)
    try {
      // Prepare CSV headers
      const headers: string[] = ['Name']
      if (exportIncludeEmails) headers.push('Email')
      if (exportIncludeAssignments) headers.push('Assigned To')
      if (exportIncludeWishes) headers.push('Gift Wish')
      if (exportIncludeConfirmationStatus) headers.push('Confirmed')
      if (exportIncludeGameDetails) {
        headers.push('Event Name', 'Amount', 'Currency', 'Date', 'Location')
      }
      if (exportIncludeInstructions) headers.push('Instructions')

      // Prepare CSV rows
      const rows = game.participants.map(participant => {
        const row: string[] = [participant.name]
        
        if (exportIncludeEmails) {
          row.push(participant.email || '')
        }
        
        if (exportIncludeAssignments) {
          row.push(getReceiverName(participant.id))
        }
        
        if (exportIncludeWishes) {
          row.push(participant.wish || participant.desiredGift || '')
        }
        
        if (exportIncludeConfirmationStatus) {
          row.push(participant.hasConfirmedAssignment ? 'Yes' : 'No')
        }
        
        if (exportIncludeGameDetails) {
          row.push(
            game.name,
            game.amount,
            game.currency,
            formatDate(game.date, language),
            game.location
          )
        }
        
        if (exportIncludeInstructions) {
          row.push(game.generalNotes || '')
        }
        
        return row
      })

      // Convert to CSV format
      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${game.name.replace(/[^a-z0-9]/gi, '_')}_participants.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(t('exportSuccess'))
      setShowExportDialog(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export'
      toast.error(t('exportError'))
      console.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-between items-center p-4 border-b">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={20} />
          {t('back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={refreshGameData}
            disabled={isRefreshing}
            title={t('refreshData')}
          >
            <ArrowsClockwise size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </Button>
          <LanguageToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-3 rounded-full shrink-0">
                  <ShieldCheck size={32} weight="duotone" className="text-amber-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold text-primary">
                    {t('organizerPanel')}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t('organizerPanelDesc')}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="self-start sm:ml-auto">
                {t('organizerOnly')}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Badge variant="outline" className="text-lg font-mono px-3 py-1">
                {game.code}
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold">{game.name}</span>
            </div>
          </Card>
        </motion.div>

        {/* Organizer Link Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className={`p-4 rounded-lg border-2 flex flex-col sm:flex-row sm:items-center gap-3 ${
            !emailConfigured 
              ? 'bg-red-50 border-red-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3 flex-1">
              {!emailConfigured && (
                <Warning size={24} className="text-red-600 shrink-0 mt-0.5" weight="duotone" />
              )}
              {emailConfigured && (
                <Key size={24} className="text-blue-600 shrink-0 mt-0.5" weight="duotone" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${
                  !emailConfigured ? 'text-red-900' : 'text-blue-900'
                }`}>
                  {t('organizerLink')}
                </p>
                <p className={`text-sm ${
                  !emailConfigured ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {!emailConfigured
                    ? t('emailNotConfiguredSaveLink')
                    : t('useOrganizerPanelLink')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                const link = buildShareableUrl({ code: game.code, organizer: game.organizerToken, lang: language })
                copyToClipboard(link)
                toast.success(t('linkCopied'))
              }}
              variant={!emailConfigured ? 'destructive' : 'default'}
              size="sm"
              className="gap-2 shrink-0"
            >
              <Copy size={16} />
              {t('copyOrganizerLink')}
            </Button>
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Users size={20} className="text-primary" />
              {t('statistics')}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{totalParticipants}</p>
                <p className="text-sm text-muted-foreground">{t('totalParticipants')}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
                <p className="text-sm text-muted-foreground">{t('assignmentsConfirmed')}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-pink-600">{wishCount}</p>
                <p className="text-sm text-muted-foreground">{t('wishesAdded')}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{pendingRequestsCount}</p>
                <p className="text-sm text-muted-foreground">{t('pendingReassignmentRequests')}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Game Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Gift size={20} className="text-primary" />
                {t('eventDetails')}
              </h2>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                  <PencilSimple size={16} />
                  {t('editEvent')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                    <X size={16} />
                  </Button>
                  <Button size="sm" onClick={handleSaveChanges} className="gap-2" disabled={isSaving || (editDate && !isValidDate(editDate))}>
                    {isSaving ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} />}
                    {t('saveChanges')}
                  </Button>
                </div>
              )}
            </div>

            {!isEditing ? (
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CurrencyDollar size={24} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('amount')}</p>
                    <p className="text-base font-semibold">{formatAmount(game.amount, game.currency, t('notSpecified'))}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CalendarBlank size={24} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('date')}</p>
                    <p className="text-base font-semibold">{formatDate(game.date, language)}{game.time && ` - ${game.time}`}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <MapPin size={24} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('location')}</p>
                    <p className="text-base font-semibold">{game.location}</p>
                  </div>
                </div>

                {game.generalNotes && (
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Note size={24} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('instructions')}</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{game.generalNotes}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Shuffle size={24} className="text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('allowReassignment')}</p>
                    <p className="text-base font-semibold">
                      {game.allowReassignment ? '✅ ' + t('confirm') : '❌ ' + t('cancel')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('eventName')}</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t('giftAmount')}</Label>
                  <div className="flex gap-2">
                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            <span className="flex items-center gap-2">
                              <span>{curr.flag}</span>
                              <span>{curr.code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('eventDate')}</Label>
                  <Input 
                    type="date" 
                    value={editDate} 
                    onChange={(e) => setEditDate(e.target.value)}
                    className={editDate && !isValidDate(editDate) ? 'border-red-500' : ''}
                  />
                  {editDate && !isValidDate(editDate) && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <Warning size={14} />
                      {t('invalidDate')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('eventTime')}</Label>
                  <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t('eventLocation')}</Label>
                  <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t('generalNotes')}</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Switch
                    checked={editAllowReassignment}
                    onCheckedChange={setEditAllowReassignment}
                  />
                  <div>
                    <p className="text-sm font-semibold">{t('allowReassignment')}</p>
                    <p className="text-xs text-muted-foreground">{t('allowReassignmentDesc')}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Participant Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users size={20} className="text-primary" />
                {t('participantStatus')}
              </h2>
              <div className="flex gap-2">
                {emailConfigured && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setParticipantToRemind(null)
                      setReminderMessage('')
                      setShowReminderDialog(true)
                    }}
                    className="gap-2"
                    disabled={game.participants.filter(p => p.email).length === 0}
                  >
                    <Bell size={16} />
                    {t('sendReminderAll')}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                  className="gap-2"
                  disabled={game.participants.length === 0}
                >
                  <Download size={16} />
                  {t('exportParticipants')}
                </Button>
              </div>
            </div>

            {/* Add new participant */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={nameInputRef}
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder={t('participantNamePlaceholder')}
                    onKeyDown={handleNameKeyDown}
                    disabled={isAddingParticipant}
                    className={newParticipantName.trim() && emailConfigured ? 'pr-32' : ''}
                  />
                  {newParticipantName.trim() && emailConfigured && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1">
                      {t('tabToAddEmail')}
                    </span>
                  )}
                </div>
              </div>
              {emailConfigured && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={emailInputRef}
                      type="email"
                      value={newParticipantEmail}
                      onChange={(e) => setNewParticipantEmail(e.target.value)}
                      placeholder={t('participantEmailPlaceholder')}
                      onKeyDown={handleEmailKeyDown}
                      disabled={isAddingParticipant}
                      className={!newParticipantEmail ? '' : 'pr-32'}
                    />
                    {!newParticipantEmail && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1 pointer-events-none">
                        {t('participantEmailOptional')}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={handleAddParticipant} 
                    className="gap-2 shrink-0"
                    disabled={isAddingParticipant || !newParticipantName.trim()}
                  >
                    {isAddingParticipant ? (
                      <CircleNotch size={20} className="animate-spin" />
                    ) : (
                      <UserPlus size={20} />
                    )}
                    {t('addParticipant')}
                  </Button>
                </div>
              )}
              {!emailConfigured && (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddParticipant} 
                    className="gap-2"
                    disabled={isAddingParticipant || !newParticipantName.trim()}
                  >
                    {isAddingParticipant ? (
                      <CircleNotch size={20} className="animate-spin" />
                    ) : (
                      <UserPlus size={20} />
                    )}
                    {t('addParticipant')}
                  </Button>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {game.participants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('noParticipantsYet')}</p>
            ) : (
              <div className="space-y-2">
                {game.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{participant.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('assignedTo')}: {getReceiverName(participant.id) || '-'}
                        </span>
                        {participant.email && emailConfigured && (
                          <span className="text-xs text-blue-600 mt-1">
                            ✉️ {participant.email}
                          </span>
                        )}
                        {/* Show gift wish - prefer participant's wish, fallback to desiredGift */}
                        {(participant.wish || participant.desiredGift) && (
                          <span className="text-xs text-pink-600 mt-1">
                            🎁 {(() => {
                              const giftText = participant.wish || participant.desiredGift || ''
                              return giftText.length > 50 ? giftText.substring(0, 50) + '...' : giftText
                            })()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Confirmed status - primary indicator */}
                      {participant.hasConfirmedAssignment ? (
                        <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100">
                          <CheckCircle size={14} />
                          {t('hasConfirmed')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <CheckCircle size={14} />
                          {t('notConfirmed')}
                        </Badge>
                      )}

                      {/* Wish status - check both wish and desiredGift */}
                      {(participant.wish || participant.desiredGift) ? (
                        <Badge variant="secondary" className="gap-1 text-pink-700 bg-pink-100">
                          <Heart size={14} weight="fill" />
                          {t('hasWish')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Heart size={14} />
                          {t('noWish')}
                        </Badge>
                      )}

                      {/* Pending reassignment request status */}
                      {participant.hasPendingReassignmentRequest && (
                        <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">
                          <Clock size={14} />
                          {t('hasPendingRequest')}
                        </Badge>
                      )}

                      {/* Copy Link button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyParticipantLink(participant)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title={t('copyParticipantLink')}
                      >
                        <Copy size={16} />
                      </Button>

                      {/* Regenerate Token button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setParticipantToRegenerateToken(participant)
                          setShowRegenerateTokenDialog(true)
                          setGeneratedNewToken(false)
                          setNewParticipantLink('')
                        }}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        title={t('regenerateToken')}
                      >
                        <ArrowsClockwise size={16} />
                      </Button>

                      {/* Send Reminder button - only show if email is configured */}
                      {emailConfigured && (
                        participant.email ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReminderDialog(participant)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title={t('sendReminderToParticipant')}
                          >
                            <Bell size={16} />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="text-muted-foreground opacity-50"
                            title={t('noEmailConfigured')}
                          >
                            <Bell size={16} />
                          </Button>
                        )
                      )}

                      {/* Edit button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditParticipantDialog(participant)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <PencilSimple size={16} />
                      </Button>

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRemoveDialog(participant)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Reassignment Requests Management */}
        {game.allowReassignment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shuffle size={20} className="text-primary" />
                  {t('pendingReassignmentRequests')}
                  {pendingRequestsCount > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      {pendingRequestsCount}
                    </Badge>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  {pendingRequestsCount > 0 && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => setShowApproveAllDialog(true)}
                      className="gap-2"
                    >
                      <CheckCircle size={16} />
                      {t('approveAllPending')}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowReassignAllDialog(true)}
                    className="gap-2"
                    disabled={totalParticipants < 3}
                  >
                    <Shuffle size={16} />
                    {t('reassignAll')}
                  </Button>
                </div>
              </div>

              {(!game.reassignmentRequests || game.reassignmentRequests.length === 0) ? (
                <p className="text-center text-muted-foreground py-8">{t('noPendingRequests')}</p>
              ) : (
                <div className="space-y-2">
                  {game.reassignmentRequests.map((request) => {
                    const receiverName = getReceiverName(request.participantId)
                    return (
                      <div
                        key={request.participantId}
                        className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{request.participantName}</span>
                          <span className="text-xs text-muted-foreground">
                            {t('assignedTo')}: {receiverName || '-'}
                          </span>
                          <span className="text-xs text-amber-600 mt-1">
                            <Clock size={12} className="inline mr-1" />
                            {t('requestedAt')}: {new Date(request.requestedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelReassignmentRequest(request.participantId)}
                            disabled={isCancellingRequest === request.participantId}
                            className="gap-1 text-muted-foreground hover:text-destructive"
                          >
                            {isCancellingRequest === request.participantId ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <XCircle size={14} />
                            )}
                            {t('cancelRequest')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openApproveReassignmentDialog(request.participantId)}
                            disabled={isApprovingReassignment === request.participantId}
                            className="gap-1"
                          >
                            {isApprovingReassignment === request.participantId ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            {t('approveReassignment')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Share Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Copy size={20} className="text-primary" />
              {t('shareCode')}
            </h2>

            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('participantLink')}</p>
                <p className="text-xs text-muted-foreground mb-2">{t('participantLinkDesc')}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={buildShareableUrl({ code: game.code, lang: language })}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleCopySharedParticipantLink} className="gap-2 shrink-0">
                    <Copy size={16} />
                    {t('copyParticipantLink')}
                  </Button>
                </div>
              </div>
              
              {/* Invitation Link */}
              {game.invitationToken && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <UserPlus size={18} className="text-green-600 dark:text-green-400" weight="duotone" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">{t('invitationLink')}</p>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">{t('invitationLinkDesc')}</p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={buildShareableUrl({ code: game.code, invitation: game.invitationToken, lang: language })}
                      className="font-mono text-sm bg-white dark:bg-gray-950"
                    />
                    <Button 
                      onClick={async () => {
                        try {
                          await copyToClipboard(buildShareableUrl({ code: game.code, invitation: game.invitationToken, lang: language }))
                          toast.success(t('invitationLinkCopied'))
                        } catch (err) {
                          console.error('Failed to copy:', err)
                        }
                      }} 
                      className="gap-2 shrink-0 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                    >
                      <Copy size={16} />
                      {t('copyInvitationLink')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Regenerate Organizer Token - Only show if email is configured */}
        {emailConfigured && game.organizerEmail && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="p-6 border-purple-200">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-purple-700">
                <Key size={20} />
                {t('regenerateOrganizerTokenLink')}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t('regenerateOrganizerTokenLinkDesc')}
              </p>
              <Button 
                variant="outline"
                className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                onClick={() => setShowRegenerateOrganizerTokenDialog(true)}
              >
                <ArrowsClockwise size={16} />
                {t('regenerateOrganizerTokenLink')}
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Danger Zone - Delete Game */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 border-destructive/50">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-destructive">
              <Trash size={20} />
              {t('deleteGame')}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('deleteGameDesc')}
            </p>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteGameDialog(true)}
              className="gap-2"
            >
              <Trash size={16} />
              {t('deleteGame')}
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* Remove Participant Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning size={24} className="text-amber-500" />
              {t('removeParticipantConfirm')}
            </DialogTitle>
            <DialogDescription>
              {participantToRemove?.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)} disabled={isRemovingParticipant}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRemoveParticipant} disabled={isRemovingParticipant}>
              {isRemovingParticipant && <CircleNotch size={16} className="animate-spin mr-2" />}
              {t('removeParticipant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Reassignment Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle size={24} className="text-primary" />
              {t('approveReassignment')}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const participant = game.participants.find(p => p.id === participantToReassign)
                return participant?.name || ''
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReassignDialog(false)
                setParticipantToReassign(null)
              }} 
              disabled={isApprovingReassignment !== null}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={() => participantToReassign && handleApproveReassignment(participantToReassign)} 
              disabled={isApprovingReassignment !== null}
              className="gap-2"
            >
              {isApprovingReassignment && <CircleNotch size={16} className="animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign All Dialog */}
      <Dialog open={showReassignAllDialog} onOpenChange={setShowReassignAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning size={24} className="text-amber-500" />
              {t('reassignAll')}
            </DialogTitle>
            <DialogDescription>
              {t('reassignAllDesc')}
              {confirmedCount > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="text-amber-800 font-medium">
                    ⚠️ {confirmedCount} {t('confirmedParticipantsWarning')}
                  </p>
                  <p className="text-amber-700 text-xs mt-1">
                    {t('confirmedParticipantsWarningDesc')}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReassignAllDialog(false)} 
              disabled={isReassigningAll}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleReassignAll} 
              disabled={isReassigningAll}
              className="gap-2"
            >
              {isReassigningAll && <CircleNotch size={16} className="animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve All Pending Reassignments Dialog */}
      <Dialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={24} className="text-primary" />
              {t('approveAllPending')}
            </DialogTitle>
            <DialogDescription>
              {t('approveAllPendingDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowApproveAllDialog(false)} 
              disabled={isApprovingAllReassignments}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleApproveAllReassignments} 
              disabled={isApprovingAllReassignments}
              className="gap-2"
            >
              {isApprovingAllReassignments && <CircleNotch size={16} className="animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Participant Dialog */}
      <Dialog open={showEditParticipantDialog} onOpenChange={setShowEditParticipantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple size={24} className="text-primary" />
              {t('editParticipant')}
            </DialogTitle>
            <DialogDescription>
              {t('editParticipantDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('participantName')}</Label>
              <Input
                value={editParticipantName}
                onChange={(e) => setEditParticipantName(e.target.value)}
                placeholder={t('participantNamePlaceholder')}
              />
            </div>
            {emailConfigured && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Envelope size={16} />
                  {t('participantEmail')}
                </Label>
                <Input
                  type="email"
                  value={editParticipantEmail}
                  onChange={(e) => setEditParticipantEmail(e.target.value)}
                  placeholder={t('participantEmailPlaceholder')}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Gift size={16} />
                {t('giftWish')}
              </Label>
              <Textarea
                value={editParticipantWish || editParticipantDesiredGift}
                onChange={(e) => {
                  setEditParticipantWish(e.target.value)
                  // Clear desiredGift when wish is edited to avoid confusion
                  setEditParticipantDesiredGift('')
                }}
                placeholder={t('yourWishPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t('giftWishDesc')}</p>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Switch
                checked={editParticipantConfirmed}
                onCheckedChange={setEditParticipantConfirmed}
              />
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle size={16} />
                  {t('hasConfirmed')}
                </p>
                <p className="text-xs text-muted-foreground">{t('confirmAssignmentDesc')}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditParticipantDialog(false)
                setParticipantToEdit(null)
              }} 
              disabled={isSavingParticipant}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleSaveParticipantChanges} 
              disabled={isSavingParticipant || !editParticipantName.trim()}
              className="gap-2"
            >
              {isSavingParticipant && <CircleNotch size={16} className="animate-spin" />}
              {t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Email Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell size={24} className="text-amber-500" />
              {participantToRemind ? t('sendReminderToParticipant') : t('sendReminderAll')}
            </DialogTitle>
            <DialogDescription>
              {participantToRemind 
                ? `${t('reminderEmailDesc')} - ${participantToRemind.name}` 
                : t('reminderToAllDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {participantToRemind && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{participantToRemind.name}</p>
                <p className="text-xs text-muted-foreground">{participantToRemind.email}</p>
              </div>
            )}
            {!participantToRemind && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  {game.participants.filter(p => p.email).length} {t('participants')} {t('hasEmail').toLowerCase()}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Note size={16} />
                {t('customMessage')} ({t('desiredGiftOptional')})
              </Label>
              <Textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder={t('customMessagePlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReminderDialog(false)
                setParticipantToRemind(null)
                setReminderMessage('')
              }} 
              disabled={isSendingReminder || isSendingReminderAll}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={participantToRemind ? handleSendReminder : handleSendReminderToAll} 
              disabled={isSendingReminder || isSendingReminderAll}
              className="gap-2"
            >
              {(isSendingReminder || isSendingReminderAll) && <CircleNotch size={16} className="animate-spin" />}
              <PaperPlaneTilt size={16} />
              {participantToRemind ? t('sendReminder') : t('sendReminderAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Token Dialog */}
      <Dialog open={showRegenerateTokenDialog} onOpenChange={setShowRegenerateTokenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowsClockwise size={24} className="text-purple-600" />
              {t('regenerateTokenTitle')}
            </DialogTitle>
            <DialogDescription>
              {!generatedNewToken ? (
                <span>{t('regenerateTokenDesc')}</span>
              ) : (
                <div className="space-y-3">
                  <span className="text-green-600 font-semibold">{t('tokenRegenerated')}</span>
                  <p className="text-sm">{t('regenerateTokenConfirm')}</p>
                  <div className="bg-muted p-2 rounded text-xs break-all font-mono">
                    {newParticipantLink}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {!generatedNewToken ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setShowRegenerateTokenDialog(false)} 
                  disabled={isRegeneratingToken}
                >
                  {t('cancel')}
                </Button>
                <Button 
                  variant="default"
                  onClick={handleRegenerateParticipantToken} 
                  disabled={isRegeneratingToken}
                  className="gap-2"
                >
                  {isRegeneratingToken && <CircleNotch size={16} className="animate-spin" />}
                  <ArrowsClockwise size={16} />
                  {t('regenerateToken')}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => {
                    copyToClipboard(newParticipantLink)
                    toast.success(t('linkCopied'))
                  }}
                  className="gap-2 flex-1"
                >
                  <Copy size={16} />
                  {t('copyNewLink')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowRegenerateTokenDialog(false)}
                >
                  {t('done')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Organizer Token Dialog */}
      <Dialog open={showRegenerateOrganizerTokenDialog} onOpenChange={setShowRegenerateOrganizerTokenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Key size={24} />
              {t('regenerateOrganizerTokenLinkTitle')}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <span className="block">{t('regenerateOrganizerTokenLinkDesc')}</span>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                <p className="text-amber-800 font-medium">
                  {t('regenerateOrganizerTokenLinkWarning')}
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  {t('checkEmailForNewLink')}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRegenerateOrganizerTokenDialog(false)} 
              disabled={isRegeneratingOrganizerToken}
            >
              {t('cancel')}
            </Button>
            <Button 
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              onClick={handleRegenerateOrganizerToken} 
              disabled={isRegeneratingOrganizerToken}
            >
              {isRegeneratingOrganizerToken && <CircleNotch size={16} className="animate-spin" />}
              <Envelope size={16} />
              {t('regenerateOrganizerTokenLinkConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Participants Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download size={24} />
              {t('exportDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('exportDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-assignments" 
                checked={exportIncludeAssignments}
                onCheckedChange={(checked) => setExportIncludeAssignments(checked === true)}
              />
              <label
                htmlFor="export-assignments"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeAssignments')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-game-details" 
                checked={exportIncludeGameDetails}
                onCheckedChange={(checked) => setExportIncludeGameDetails(checked === true)}
              />
              <label
                htmlFor="export-game-details"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeGameDetails')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-wishes" 
                checked={exportIncludeWishes}
                onCheckedChange={(checked) => setExportIncludeWishes(checked === true)}
              />
              <label
                htmlFor="export-wishes"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeWishes')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-instructions" 
                checked={exportIncludeInstructions}
                onCheckedChange={(checked) => setExportIncludeInstructions(checked === true)}
              />
              <label
                htmlFor="export-instructions"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeInstructions')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-confirmation" 
                checked={exportIncludeConfirmationStatus}
                onCheckedChange={(checked) => setExportIncludeConfirmationStatus(checked === true)}
              />
              <label
                htmlFor="export-confirmation"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeConfirmationStatus')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="export-emails" 
                checked={exportIncludeEmails}
                onCheckedChange={(checked) => setExportIncludeEmails(checked === true)}
              />
              <label
                htmlFor="export-emails"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('exportIncludeEmails')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowExportDialog(false)} 
              disabled={isExporting}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleExportParticipants} 
              disabled={isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <CircleNotch size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {t('exportButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Game Dialog */}
      <Dialog open={showDeleteGameDialog} onOpenChange={setShowDeleteGameDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash size={24} />
              {t('deleteGameTitle')}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <span className="text-destructive font-semibold block">
                {t('deleteGameWarning')}
              </span>
              <span className="block">{t('deleteGameDesc')}</span>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('deleteGameItem1')}</li>
                <li>{t('deleteGameItem2')}</li>
                <li>{t('deleteGameItem3')}</li>
                <li>{t('deleteGameItem4')}</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteGameDialog(false)} 
              disabled={isDeletingGame}
            >
              {t('cancel')}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteGame} 
              disabled={isDeletingGame}
              className="gap-2"
            >
              {isDeletingGame && <CircleNotch size={16} className="animate-spin" />}
              <Trash size={16} />
              {t('deleteGameConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
