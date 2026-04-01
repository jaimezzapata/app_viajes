import { db } from '@/db/appDb'
import { supabase } from '@/supabase/client'
import type { OutboxItem } from '@/../shared/types'
import { nowIso } from '@/utils/id'

type PullSpec = {
  table: 'categorias' | 'gastos' | 'itinerarios' | 'hospedajes' | 'presupuestos'
  select: string
}

const PULL_SPECS: PullSpec[] = [
  { table: 'categorias', select: '*' },
  { table: 'gastos', select: '*' },
  { table: 'itinerarios', select: '*' },
  { table: 'hospedajes', select: '*' },
  { table: 'presupuestos', select: '*' },
]

async function markOutboxError(item: OutboxItem, message: string) {
  await db.outbox.update(item.id, {
    try_count: item.try_count + 1,
    last_error: message,
  })
}

async function removeOutboxItem(id: string) {
  await db.outbox.delete(id)
}

async function getLastSyncAt(): Promise<string | null> {
  const row = await db.sync_state.get('last_sync_success_at')
  return row?.value ?? null
}

async function setLastSyncAt(value: string) {
  await db.sync_state.put({ key: 'last_sync_success_at', value })
}

async function setLastSyncError(value: string | null) {
  await db.sync_state.put({ key: 'last_sync_error', value: value ?? '' })
}

async function pullFromSupabase() {
  const since = await getLastSyncAt()

  for (const spec of PULL_SPECS) {
    let q = supabase!.from(spec.table).select(spec.select)
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) continue

    const table = (db as unknown as Record<string, { bulkPut: (rows: unknown[]) => Promise<unknown> }>)[spec.table]
    await db.transaction('rw', table as never, async () => {
      await table.bulkPut(data)
    })
  }
}

export async function syncNow() {
  if (!supabase) return
  if (!navigator.onLine) return

  await setLastSyncError(null)
  await db.sync_state.put({ key: 'last_sync_attempt_at', value: nowIso() })

  const pending = await db.outbox.orderBy('created_at').toArray()
  for (const item of pending) {
    try {
      if (item.op === 'UPSERT') {
        const { error } = await supabase.from(item.table_name).upsert(item.payload as never)
        if (error) throw error
      }
      if (item.op === 'DELETE') {
        const { error } = await supabase.from(item.table_name).delete().eq('id', item.entity_id)
        if (error) throw error
      }

      await removeOutboxItem(item.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync_error'
      await markOutboxError(item, message)
      await setLastSyncError(message)
    }
  }

  try {
    await pullFromSupabase()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'pull_error'
    await setLastSyncError(message)
    return
  }

  await setLastSyncAt(nowIso())
}
