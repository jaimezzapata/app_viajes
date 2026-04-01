export type ItineraryFlightNotes = {
  airlines?: string[]
  stops?: string[]
  note?: string
}

export function parseItineraryNotes(raw: string): ItineraryFlightNotes {
  const txt = (raw ?? '').trim()
  if (!txt) return {}
  try {
    const obj = JSON.parse(txt) as unknown
    if (!obj || typeof obj !== 'object') return { note: txt }
    const r = obj as Record<string, unknown>
    const airlines = Array.isArray(r.airlines) ? r.airlines.map((x) => String(x)).filter(Boolean) : undefined
    const stops = Array.isArray(r.stops) ? r.stops.map((x) => String(x)).filter(Boolean) : undefined
    const note = typeof r.note === 'string' ? r.note : undefined
    return { airlines, stops, note }
  } catch {
    return { note: txt }
  }
}

export function buildItineraryNotes(notes: ItineraryFlightNotes) {
  const payload: ItineraryFlightNotes = {
    airlines: notes.airlines?.map((s) => s.trim()).filter(Boolean),
    stops: notes.stops?.map((s) => s.trim()).filter(Boolean),
    note: notes.note?.trim() || undefined,
  }

  if ((!payload.airlines || payload.airlines.length === 0) && (!payload.stops || payload.stops.length === 0) && !payload.note) {
    return ''
  }

  return JSON.stringify(payload)
}

export function splitCsv(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

