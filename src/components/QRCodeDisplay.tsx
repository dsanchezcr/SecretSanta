import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  value: string
  size?: number
  className?: string
}

export function QRCodeDisplay({ value, size = 200, className }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Reset error state when inputs change so transient failures don't permanently hide the QR code
    setError(false)
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => setError(true))
  }, [value, size])

  if (error) return null

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`QR code linking to: ${value}`}
      className={`rounded-lg border bg-white ${className || ''}`}
    />
  )
}
