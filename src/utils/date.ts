export function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map((v) => Number(v))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatDayLabel(ymd: string) {
  const dt = parseYmd(ymd)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(dt)
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWeekdayLabel(ymd: string) {
  const dt = parseYmd(ymd)
  return new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(dt)
}
