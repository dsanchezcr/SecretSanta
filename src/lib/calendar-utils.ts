/**
 * Generate an ICS calendar file for the Secret Santa event
 */
export function generateICS(event: {
  name: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  location: string
  description?: string
}): string {
  const { name, date, time, location, description } = event
  const dateParts = date.replace(/-/g, '')

  // If time is provided, use it. Otherwise, make it an all-day event.
  let dtStart: string
  let dtEnd: string

  if (time) {
    const timeParts = time.replace(/:/g, '')
    dtStart = `${dateParts}T${timeParts}00`
    // Default 2-hour event
    const start = new Date(`${date}T${time}`)
    start.setHours(start.getHours() + 2)
    const endH = String(start.getHours()).padStart(2, '0')
    const endM = String(start.getMinutes()).padStart(2, '0')
    dtEnd = `${dateParts}T${endH}${endM}00`
  } else {
    dtStart = dateParts
    // All-day events: end date is next day
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dtEnd = `${y}${m}${day}`
  }

  const uid = `secretsanta-${dateParts}-${Math.random().toString(36).slice(2)}@secretsanta`
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

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
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n')
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
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
