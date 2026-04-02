import type { AppActivity, AppBudget, AppCategory, AppExpense, AppItinerary, AppLodging, AppTrip, UUID } from '@/../shared/types'
import { db } from '@/db/appDb'
import { nowIso, newId } from '@/utils/id'

type TableName = 'categorias' | 'gastos' | 'itinerarios' | 'hospedajes' | 'presupuestos' | 'viajes' | 'actividades'

export type TripBackupV1 = {
  version: 1
  exported_at: string
  trip: AppTrip
  categories: AppCategory[]
  expenses: AppExpense[]
  itineraries: AppItinerary[]
  lodgings: AppLodging[]
  activities: AppActivity[]
  budgets: AppBudget[]
}

export async function exportTripBackup(tripId: UUID): Promise<TripBackupV1> {
  const trip = await db.viajes.get(tripId)
  if (!trip || trip.deleted_at != null) throw new Error('No se encontró el viaje para exportar.')

  const [categories, expenses, itineraries, lodgings, activities, budgets] = await Promise.all([
    db.categorias.filter((c) => c.deleted_at == null).toArray(),
    db.gastos.where('trip_id').equals(tripId).filter((e) => e.deleted_at == null).toArray(),
    db.itinerarios.where('trip_id').equals(tripId).filter((i) => i.deleted_at == null).toArray(),
    db.hospedajes.where('trip_id').equals(tripId).filter((h) => h.deleted_at == null).toArray(),
    db.actividades.where('trip_id').equals(tripId).filter((a) => a.deleted_at == null).toArray(),
    db.presupuestos.where('trip_id').equals(tripId).filter((b) => b.deleted_at == null).toArray(),
  ])

  return {
    version: 1,
    exported_at: nowIso(),
    trip,
    categories,
    expenses,
    itineraries,
    lodgings,
    activities,
    budgets,
  }
}

function buildIdMap(ids: string[]) {
  const map = new Map<string, string>()
  for (const id of ids) {
    if (!id) continue
    if (!map.has(id)) map.set(id, newId())
  }
  return map
}

export async function importTripBackup(payload: TripBackupV1): Promise<UUID> {
  if (!payload || payload.version !== 1) throw new Error('Backup no soportado o corrupto.')

  const ts = nowIso()
  const newTripId = newId() as UUID

  const allEntityIds = [
    ...payload.expenses.map((e) => e.id),
    ...payload.itineraries.map((i) => i.id),
    ...payload.lodgings.map((h) => h.id),
    ...payload.activities.map((a) => a.id),
    ...payload.budgets.map((b) => b.id),
  ]
  const idMap = buildIdMap(allEntityIds)

  const newTrip: AppTrip = {
    ...payload.trip,
    id: newTripId,
    user_id: null,
    name: `${payload.trip.name} (importado)`,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }

  const expenses: AppExpense[] = payload.expenses.map((e) => ({
    ...e,
    id: idMap.get(e.id) ?? newId(),
    user_id: null,
    trip_id: newTripId,
    deleted_at: null,
  }))

  const itineraries: AppItinerary[] = payload.itineraries.map((i) => ({
    ...i,
    id: idMap.get(i.id) ?? newId(),
    user_id: null,
    trip_id: newTripId,
    deleted_at: null,
  }))

  const lodgings: AppLodging[] = payload.lodgings.map((h) => ({
    ...h,
    id: idMap.get(h.id) ?? newId(),
    user_id: null,
    trip_id: newTripId,
    deleted_at: null,
  }))

  const activities: AppActivity[] = payload.activities.map((a) => ({
    ...a,
    id: idMap.get(a.id) ?? newId(),
    user_id: null,
    trip_id: newTripId,
    deleted_at: null,
  }))

  const budgets: AppBudget[] = payload.budgets.map((b) => ({
    ...b,
    id: idMap.get(b.id) ?? newId(),
    user_id: null,
    trip_id: newTripId,
    deleted_at: null,
  }))

  const categories: AppCategory[] = payload.categories.map((c) => ({
    ...c,
    deleted_at: null,
    updated_at: ts,
  }))

  await db.transaction(
    'rw',
    [db.viajes, db.categorias, db.gastos, db.itinerarios, db.hospedajes, db.actividades, db.presupuestos, db.outbox],
    async () => {
      await db.viajes.put(newTrip)

      if (categories.length) {
        await db.categorias.bulkPut(categories)
        for (const c of categories) {
          await db.outbox.add({
            id: newId(),
            table_name: 'categorias',
            op: 'UPSERT',
            entity_id: c.id,
            payload: c,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        }
      }

      const enqueueMany = async (table_name: TableName, rows: Array<{ id: string } & Record<string, unknown>>) => {
        for (const r of rows) {
          await db.outbox.add({
            id: newId(),
            table_name,
            op: 'UPSERT',
            entity_id: r.id,
            payload: r,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        }
      }

      if (expenses.length) {
        await db.gastos.bulkPut(expenses)
        await enqueueMany('gastos', expenses as any)
      }
      if (itineraries.length) {
        await db.itinerarios.bulkPut(itineraries)
        await enqueueMany('itinerarios', itineraries as any)
      }
      if (lodgings.length) {
        await db.hospedajes.bulkPut(lodgings)
        await enqueueMany('hospedajes', lodgings as any)
      }
      if (activities.length) {
        await db.actividades.bulkPut(activities)
        await enqueueMany('actividades', activities as any)
      }
      if (budgets.length) {
        await db.presupuestos.bulkPut(budgets)
        await enqueueMany('presupuestos', budgets as any)
      }

      await db.outbox.add({
        id: newId(),
        table_name: 'viajes',
        op: 'UPSERT',
        entity_id: newTrip.id,
        payload: newTrip,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })
    },
  )

  return newTripId
}
