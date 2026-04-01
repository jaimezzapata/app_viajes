import Dexie, { type Table } from 'dexie'
import type { AppBudget, AppCategory, AppExpense, AppItinerary, AppLodging, MetaKV, OutboxItem, SyncState, UUID, AppTrip, AppActivity } from '@/../shared/types'

export class AppDb extends Dexie {
  categorias!: Table<AppCategory, UUID>
  gastos!: Table<AppExpense, UUID>
  itinerarios!: Table<AppItinerary, UUID>
  hospedajes!: Table<AppLodging, UUID>
  presupuestos!: Table<AppBudget, UUID>
  viajes!: Table<AppTrip, UUID>
  actividades!: Table<AppActivity, UUID>

  outbox!: Table<OutboxItem, UUID>
  sync_state!: Table<SyncState, string>
  meta!: Table<MetaKV, string>

  constructor() {
    super('app_viajes_db')

    this.version(3).stores({
      categorias: '&id, kind, updated_at',
      gastos: '&id, date, stage, category_id, updated_at',
      itinerarios: '&id, date, stage, type, updated_at',
      hospedajes: '&id, stage, check_in, check_out, updated_at',
      presupuestos: '&id, stage, updated_at',
      outbox: '&id, table_name, op, entity_id, created_at, try_count',
      sync_state: '&key',
      meta: '&key',
    })

    this.version(4).stores({
      viajes: '&id, updated_at',
      actividades: '&id, trip_id, date, stage, updated_at',
      gastos: '&id, trip_id, date, stage, category_id, updated_at',
      itinerarios: '&id, trip_id, date, stage, type, updated_at',
      hospedajes: '&id, trip_id, stage, check_in, check_out, updated_at',
      presupuestos: '&id, trip_id, stage, updated_at',
    }).upgrade(async (tx) => {
      const gastosCount = await tx.table('gastos').count()
      const itisCount = await tx.table('itinerarios').count()
      const DEFAULT_TRIP_ID = '00000000-0000-0000-0000-000000000001'
      
      if (gastosCount > 0 || itisCount > 0) {
        const ts = new Date().toISOString()
        await tx.table('viajes').put({
          id: DEFAULT_TRIP_ID,
          user_id: null,
          name: 'Mi Primer Viaje',
          start_date: new Date().toISOString().split('T')[0] ?? '2026-01-01',
          end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] ?? '2026-01-31',
          is_national: false,
          countries_json: JSON.stringify([
            { code: 'COLOMBIA', acronym: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP' },
            { code: 'ESPANA', acronym: 'ES', name: 'España', flag: '🇪🇸', currency: 'EUR' },
            { code: 'JAPON', acronym: 'JP', name: 'Japón', flag: '🇯🇵', currency: 'JPY' }
          ]),
          segments_json: '[]',
          created_at: ts,
          updated_at: ts,
          deleted_at: null
        })

        await tx.table('gastos').toCollection().modify(g => { if (!g.trip_id) g.trip_id = DEFAULT_TRIP_ID })
        await tx.table('itinerarios').toCollection().modify(i => { if (!i.trip_id) i.trip_id = DEFAULT_TRIP_ID })
        await tx.table('hospedajes').toCollection().modify(h => { if (!h.trip_id) h.trip_id = DEFAULT_TRIP_ID })
        await tx.table('presupuestos').toCollection().modify(p => { if (!p.trip_id) p.trip_id = DEFAULT_TRIP_ID })
      }
    })
  }
}

export const db = new AppDb()
