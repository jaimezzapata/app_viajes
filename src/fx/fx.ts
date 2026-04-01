import { db } from '@/db/appDb'
import type { CurrencyCode } from '@/../shared/types'

export type FxRateToCop = {
  from: CurrencyCode
  to: 'COP'
  rate: number
  quote_date: string
  fetched_at: string
  source: 'fawazahmed0'
}

const TTL_MS = 1000 * 60 * 60 * 12

function metaKey(from: CurrencyCode, ymd?: string) {
  const d = ymd?.trim() ? ymd.trim() : 'latest'
  return `fx_${from}_COP_${d}`
}

function nowIso() {
  return new Date().toISOString()
}

function safeParse<T>(value: string | undefined | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function formatFxRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return ''
  if (rate < 100) return rate.toFixed(4)
  return rate.toFixed(2)
}

export async function getRateToCop(from: CurrencyCode, ymd?: string): Promise<FxRateToCop> {
  if (from === 'COP') {
    return { from, to: 'COP', rate: 1, quote_date: nowIso().slice(0, 10), fetched_at: nowIso(), source: 'fawazahmed0' }
  }

  const dateKey = ymd?.trim() ? ymd.trim() : undefined
  const key = metaKey(from, dateKey)
  const cachedRow = await db.meta.get(key)
  const cached = safeParse<FxRateToCop>(cachedRow?.value)

  const cachedOk =
    !!cached &&
    cached.from === from &&
    cached.to === 'COP' &&
    Number.isFinite(cached.rate) &&
    cached.rate > 0 &&
    !!cached.fetched_at

  if (cachedOk) {
    if (dateKey) return cached
    const age = Date.now() - new Date(cached.fetched_at).getTime()
    if (!Number.isFinite(age) || age < TTL_MS) return cached
    if (!navigator.onLine) return cached
  }

  const base = from.toLowerCase()
  const urls: string[] = []
  
  if (dateKey) {
    urls.push(`https://${dateKey}.currency-api.pages.dev/v1/currencies/${base}.json`)
    urls.push(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateKey}/v1/currencies/${base}.json`)
  }
  urls.push(`https://latest.currency-api.pages.dev/v1/currencies/${base}.json`)
  urls.push(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`)

  let lastStatus: number | null = null
  let json: unknown = null
  for (const url of urls) {
    try {
      const resp = await fetch(url, { headers: { Accept: 'application/json' } })
      lastStatus = resp.status
      if (!resp.ok) continue
      json = await resp.json()
      break
    } catch {
      continue
    }
  }

  const obj = json as Record<string, unknown> | null
  const nested = obj && typeof obj === 'object' ? (obj[base] as Record<string, unknown> | undefined) : undefined
  const rate = Number(nested?.cop)
  if (!Number.isFinite(rate) || rate <= 0) {
    if (cachedOk) return cached
    throw new Error(`Tasa inválida para ${from}->COP${lastStatus ? ` (${lastStatus})` : ''}`)
  }

  const fx: FxRateToCop = {
    from,
    to: 'COP',
    rate,
    quote_date: String((obj?.date as string | undefined) ?? dateKey ?? nowIso().slice(0, 10)),
    fetched_at: nowIso(),
    source: 'fawazahmed0',
  }

  await db.meta.put({ key, value: JSON.stringify(fx) })
  return fx
}
