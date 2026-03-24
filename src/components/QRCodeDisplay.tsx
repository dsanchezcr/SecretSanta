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
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => setError(false))
      .catch(() => setError(true))
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`QR code linking to: ${value}`}
      className={`rounded-lg border bg-white ${className || ''}`}
      style={error ? { display: 'none' } : undefined}
    />
  )
}
