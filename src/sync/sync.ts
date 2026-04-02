import { db } from '@/db/appDb'
import { supabase } from '@/supabase/client'
import type { OutboxItem } from '@/../shared/types'
import { nowIso } from '@/utils/id'

type PullSpec = {
  table: 'categorias' | 'gastos' | 'itinerarios' | 'hospedajes' | 'presupuestos' | 'viajes' | 'actividades'
  select: string
}

const PULL_SPECS: PullSpec[] = [
  { table: 'categorias', select: '*' },
  { table: 'gastos', select: '*' },
  { table: 'itinerarios', select: '*' },
  { table: 'hospedajes', select: '*' },
  { table: 'presupuestos', select: '*' },
  { table: 'viajes', select: '*' },
  { table: 'actividades', select: '*' },
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

async function pullFromSupabase(uid: string) {
  const since = await getLastSyncAt()

  await Promise.all(
    PULL_SPECS.map(async (spec) => {
      let q = supabase!.from(spec.table).select(spec.select)
      
      if (spec.table === 'categorias') {
        q = q.or(`user_id.eq.${uid},user_id.is.null`)
      } else {
        q = q.eq('user_id', uid)
      }

      if (since) q = q.gt('updated_at', since)
      
      const { data, error } = await q
      if (error) throw error
      if (!data || data.length === 0) return

      const table = (db as unknown as Record<string, { bulkPut: (rows: unknown[]) => Promise<unknown> }>)[spec.table]
      await db.transaction('rw', table as never, async () => {
        await table.bulkPut(data)
      })
    })
  )
}

export async function syncNow() {
  if (!supabase) return
  if (!navigator.onLine) return

  const { data: authData } = await supabase.auth.getSession()
  const uid = authData?.session?.user?.id
  if (!uid) return

  await setLastSyncError(null)
  const syncAttemptTs = nowIso()
  await db.sync_state.put({ key: 'last_sync_attempt_at', value: syncAttemptTs })

  const pending = await db.outbox.orderBy('created_at').toArray()

  if (pending.length > 0) {
    const entityToOutboxIds = new Map<string, string[]>()
    const latestByEntity = new Map<string, OutboxItem>()

    for (const item of pending) {
      if (!entityToOutboxIds.has(item.entity_id)) {
        entityToOutboxIds.set(item.entity_id, [])
      }
      entityToOutboxIds.get(item.entity_id)!.push(item.id)
      latestByEntity.set(item.entity_id, item)
    }

    const byTable = new Map<string, { upserts: OutboxItem[]; deletes: OutboxItem[] }>()
    for (const item of latestByEntity.values()) {
      if (!byTable.has(item.table_name)) {
        byTable.set(item.table_name, { upserts: [], deletes: [] })
      }
      if (item.op === 'UPSERT') {
        byTable.get(item.table_name)!.upserts.push(item)
      } else {
        byTable.get(item.table_name)!.deletes.push(item)
      }
    }

    const TABLE_ORDER = ['viajes', 'categorias', 'presupuestos', 'hospedajes', 'itinerarios', 'actividades', 'gastos']
    const tablesToProcess = Array.from(byTable.keys()).sort((a, b) => {
      let ia = TABLE_ORDER.indexOf(a)
      let ib = TABLE_ORDER.indexOf(b)
      if (ia === -1) ia = 999
      if (ib === -1) ib = 999
      return ia - ib
    })

    const successOutboxIds: string[] = []

    for (const table of tablesToProcess) {
      const group = byTable.get(table)!

      if (group.upserts.length > 0) {
        const payloads = group.upserts.map((i) => {
          const p = { ...(i.payload as Record<string, unknown>) }
          if (uid && typeof p === 'object' && ('user_id' in p) && !p.user_id) {
            p.user_id = uid
          }
          return p
        })

        try {
          const { error } = await supabase.from(table).upsert(payloads as never[])
          if (error) throw error
          for (const i of group.upserts) {
            successOutboxIds.push(...(entityToOutboxIds.get(i.entity_id) ?? []))
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'sync_error'
          for (const i of group.upserts) {
            const ids = entityToOutboxIds.get(i.entity_id) ?? []
            for (const id of ids) {
              const item = pending.find((x) => x.id === id)
              if (item) await markOutboxError(item, message)
            }
          }
          await setLastSyncError(message)
        }
      }

      if (group.deletes.length > 0) {
        const idsToDelete = group.deletes.map((i) => i.entity_id)
        try {
          const { error } = await supabase.from(table).delete().in('id', idsToDelete)
          if (error) throw error
          for (const i of group.deletes) {
            successOutboxIds.push(...(entityToOutboxIds.get(i.entity_id) ?? []))
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'sync_error'
          for (const i of group.deletes) {
            const ids = entityToOutboxIds.get(i.entity_id) ?? []
            for (const id of ids) {
              const item = pending.find((x) => x.id === id)
              if (item) await markOutboxError(item, message)
            }
          }
          await setLastSyncError(message)
        }
      }
    }

    if (successOutboxIds.length > 0) {
      await db.outbox.bulkDelete(successOutboxIds)
    }
  }

  try {
    await pullFromSupabase(uid)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'pull_error'
    await setLastSyncError(message)
    return
  }

  await setLastSyncAt(nowIso())
}
