export function cca2ToFlagEmoji(cca2: string) {
  const c = String(cca2 ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  const a = 0x1f1e6
  const first = a + (c.charCodeAt(0) - 65)
  const second = a + (c.charCodeAt(1) - 65)
  return String.fromCodePoint(first, second)
}

function looksLikeEmojiFlag(s: string) {
  const chars = Array.from(String(s ?? ''))
  if (chars.length !== 2) return false
  const [a, b] = chars
  const ca = a.codePointAt(0) ?? 0
  const cb = b.codePointAt(0) ?? 0
  return ca >= 0x1f1e6 && ca <= 0x1f1ff && cb >= 0x1f1e6 && cb <= 0x1f1ff
}

export function normalizeCountryFlag(flag: string | null | undefined, cca2OrAcronym?: string | null | undefined) {
  const raw = String(flag ?? '').trim()
  if (looksLikeEmojiFlag(raw)) return raw
  const raw2 = raw.toUpperCase()
  if (/^[A-Z]{2}$/.test(raw2)) return cca2ToFlagEmoji(raw2)
  const fallback = String(cca2OrAcronym ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(fallback)) return cca2ToFlagEmoji(fallback)
  return ''
}
