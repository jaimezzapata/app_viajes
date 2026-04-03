import { db } from '@/db/appDb'

function key(tripId: string) {
  return `trip_share_token_${tripId}`
}

export async function getTripShareToken(tripId: string): Promise<string | null> {
  const row = await db.meta.get(key(tripId))
  const token = row?.value?.trim()
  return token ? token : null
}

export async function setTripShareToken(tripId: string, token: string): Promise<void> {
  await db.meta.put({ key: key(tripId), value: token })
}

export function tripShareUrl(token: string) {
  return `${window.location.origin}/compartir/${token}`
}

