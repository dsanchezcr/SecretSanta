/**
 * Generates a QR code SVG data URL using a third-party API-free approach.
 * Uses a simple encoding of the URL into a visual grid pattern.
 * For production use, this creates a shareable text-based representation.
 */

/**
 * Copy the invitation URL to clipboard and show a toast.
 * This is the primary sharing mechanism; QR code generation
 * can be added later with a library like `qrcode`.
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
