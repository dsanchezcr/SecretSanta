import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  value: string
  size?: number
  className?: string
  ariaLabel?: string
}

export function QRCodeDisplay({ value, size = 200, className, ariaLabel }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    let cancelled = false
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => { if (!cancelled) setError(false) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [value, size])

  if (error) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block text-sm underline text-blue-600 ${className || ''}`}
      >
        {value}
      </a>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel || 'Invitation QR code'}
      className={`rounded-lg border bg-white ${className || ''}`}
    />
  )
}
