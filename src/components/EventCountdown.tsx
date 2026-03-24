import { useState, useEffect } from 'react'

interface CountdownProps {
  targetDate: string // YYYY-MM-DD
  targetTime?: string // HH:MM
  label: string
}

export function EventCountdown({ targetDate, targetTime, label }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculate = () => {
      const target = targetTime
        ? new Date(`${targetDate}T${targetTime}`)
        : new Date(`${targetDate}T23:59:59`)
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
        setTimeLeft(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else {
        setTimeLeft(`${minutes}m`)
      }
    }

    calculate()
    const interval = setInterval(calculate, 60_000) // Update every minute
    return () => clearInterval(interval)
  }, [targetDate, targetTime])

  if (!timeLeft) return null

  return (
    <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-primary tabular-nums">{timeLeft}</p>
    </div>
  )
}
