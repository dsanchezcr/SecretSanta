/**
 * Generate an ICS calendar file for the Secret Santa event
 */
export function generateICS(event: {
  name: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  location: string
  description?: string
  assignedTo?: string
  desiredGift?: string
  wish?: string
  amount?: string
  currency?: string
  generalNotes?: string
}): string {
  const { name, date, time, location, description, assignedTo, desiredGift, wish, amount, currency, generalNotes } = event
  const dateParts = date.replace(/-/g, '')

  // If time is provided, use it. Otherwise, make it an all-day event.
  let dtStart: string
  let dtEnd: string

  if (time) {
    const timeParts = time.replace(/:/g, '')
    dtStart = `${dateParts}T${timeParts}00`
    // Default 2-hour event; build end from a local date to handle midnight crossings
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const end = new Date(year, month - 1, day, hour + 2, minute)
    const endDate = String(end.getFullYear()) +
      String(end.getMonth() + 1).padStart(2, '0') +
      String(end.getDate()).padStart(2, '0')
    const endH = String(end.getHours()).padStart(2, '0')
    const endM = String(end.getMinutes()).padStart(2, '0')
    dtEnd = `${endDate}T${endH}${endM}00`
  } else {
    dtStart = dateParts
    // All-day events: end date is next day; parse components explicitly to avoid UTC shift
    const [year, month, day] = date.split('-').map(Number)
    const d = new Date(year, month - 1, day + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    dtEnd = `${y}${m}${dy}`
  }

  const randomBytes = new Uint8Array(8)
  window.crypto.getRandomValues(randomBytes)
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const uid = `secretsanta-${dateParts}-${randomHex}@secretsanta`
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  // Build rich description with all game details
  const descParts: string[] = []
  if (assignedTo) descParts.push(`🎁 You are giving a gift to: ${assignedTo}`)
  if (desiredGift) descParts.push(`🎄 Their desired gift: ${desiredGift}`)
  if (wish) descParts.push(`✨ Their wish: ${wish}`)
  if (amount && currency) descParts.push(`💰 Budget: ${currency} ${amount}`)
  else if (amount) descParts.push(`💰 Budget: ${amount}`)
  if (generalNotes) descParts.push(`📝 Notes: ${generalNotes}`)
  if (description && description !== generalNotes) descParts.push(description)
  const fullDescription = descParts.join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Secret Santa//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    time ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    time ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeICS(name)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    fullDescription ? `DESCRIPTION:${escapeICS(fullDescription)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  // Apply RFC 5545 line folding: lines longer than 75 octets must be folded
  return lines.map(foldLine).join('\r\n')
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

/**
 * RFC 5545 line folding: lines longer than 75 octets are folded with CRLF + space.
 */
function foldLine(line: string): string {
  const MAX_OCTETS = 75
  if (new TextEncoder().encode(line).length <= MAX_OCTETS) return line
  const encoder = new TextEncoder()
  const parts: string[] = []
  let remaining = line
  let isFirst = true
  while (remaining.length > 0) {
    const limit = isFirst ? MAX_OCTETS : MAX_OCTETS - 1 // subsequent lines have leading space
    let end = remaining.length
    while (encoder.encode(remaining.slice(0, end)).length > limit && end > 1) {
      end--
    }
    parts.push(remaining.slice(0, end))
    remaining = remaining.slice(end)
    isFirst = false
  }
  return parts.join('\r\n ')
}

export function downloadICS(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
