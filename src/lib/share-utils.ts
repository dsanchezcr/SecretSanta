/**
 * Sharing and clipboard utilities.
 */

/**
 * Copy the invitation URL to clipboard and show a toast.
 * QR code display is handled by the QRCodeDisplay component.
 */
export function getShareableUrl(baseUrl: string, gameCode: string, token?: string): string {
  const params = new URLSearchParams()
  params.set('code', gameCode)
  if (token) params.set('invitation', token)
  return `${baseUrl}?${params.toString()}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)
    return success
  }
}

/**
 * Use the Web Share API for native sharing on mobile.
 * Returns true if sharing was initiated, false if not supported.
 */
export async function nativeShare(data: { title: string; text: string; url: string }): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share(data)
    return true
  } catch {
    // User cancelled or share failed
    return false
  }
}

/**
 * Check if the Web Share API is available (for conditional UI rendering).
 */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share
}
