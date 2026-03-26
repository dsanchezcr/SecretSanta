import { useState, useEffect } from 'react'
import { useLanguage } from './useLanguage'

interface CountdownProps {
  targetDate: string // YYYY-MM-DD
  targetTime?: string // HH:MM
  label: string
}

// Time unit translations
const timeUnits: Record<string, { d: string; h: string; m: string }> = {
  en: { d: 'd', h: 'h', m: 'm' },
  es: { d: 'd', h: 'h', m: 'min' },
  pt: { d: 'd', h: 'h', m: 'min' },
  fr: { d: 'j', h: 'h', m: 'min' },
  it: { d: 'g', h: 'h', m: 'min' },
  ja: { d: '日', h: '時間', m: '分' },
  zh: { d: '天', h: '时', m: '分' },
  de: { d: 'T', h: 'Std', m: 'Min' },
  nl: { d: 'd', h: 'u', m: 'min' },
}

export function EventCountdown({ targetDate, targetTime, label }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('')
  const { language } = useLanguage()
  const units = timeUnits[language] || timeUnits.en

  useEffect(() => {
    // Parse YYYY-MM-DD into numeric components once; validate to avoid NaN dates
    const dateParts = targetDate.split('-').map(Number)
    if (dateParts.length !== 3 || dateParts.some(isNaN)) return
    const [year, month, day] = dateParts

    const calculate = () => {
      let target: Date
      if (targetTime) {
        // Parse components explicitly to use local time (ISO string T-format may vary across engines)
        const timeParts = targetTime.split(':').map(Number)
        if (timeParts.length < 2 || timeParts.some(isNaN)) return
        const [hour, minute] = timeParts
        target = new Date(year, month - 1, day, hour, minute)
      } else {
        // End-of-day fallback: 23:59:59 local time
        target = new Date(year, month - 1, day, 23, 59, 59)
      }
      const now = new Date()
      const diff = target.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) {
        setTimeLeft(`${days}${units.d} ${hours}${units.h} ${minutes}${units.m}`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}${units.h} ${minutes}${units.m}`)
      } else {
        setTimeLeft(`${minutes}${units.m}`)
      }
    }

    calculate()
    const interval = setInterval(calculate, 60_000)
    return () => clearInterval(interval)
  }, [targetDate, targetTime, units])

  if (!timeLeft) return null

  return (
    <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-primary tabular-nums">{timeLeft}</p>
    </div>
  )
}
