import Page from '@/components/Page'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { stageForYmd, useTripStore } from '@/stores/tripStore'
import { useMemo, useState } from 'react'
import type { AppActivity, AppCategory, AppExpense, AppItinerary, AppLodging, CategoryKind } from '@/../shared/types'
import { useDynamicHead } from '@/hooks/useDynamicHead'
import { newId, nowIso } from '@/utils/id'

type Issue = { key: string; title: string; severity: 'error' | 'warn'; lines: string[] }

export default function Diagnostics() {
  useDynamicHead('Salud de datos', 'TriangleAlert')
  const activeTripId = useTripStore((s) => s.activeTripId)
  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const countries = useTripStore((s) => s.countries)
  const segments = useTripStore((s) => s.segments)
  const [fixing, setFixing] = useState(false)

  const { value: categories = [] } = useLiveQuery<AppCategory[]>(async () => await db.categorias.filter((c) => c.deleted_at == null).toArray(), [], [])

  const { value: expenses = [] } = useLiveQuery<AppExpense[]>(
    async () => {
      if (!activeTripId) return []
      return await db.gastos.where('trip_id').equals(activeTripId).filter((e) => e.deleted_at == null).toArray()
    },
    [activeTripId],
    [],
  )

  const { value: itineraries = [] } = useLiveQuery<AppItinerary[]>(
    async () => {
      if (!activeTripId) return []
      return await db.itinerarios.where('trip_id').equals(activeTripId).filter((i) => i.deleted_at == null).toArray()
    },
    [activeTripId],
    [],
  )

  const { value: lodgings = [] } = useLiveQuery<AppLodging[]>(
    async () => {
      if (!activeTripId) return []
      return await db.hospedajes.where('trip_id').equals(activeTripId).filter((h) => h.deleted_at == null).toArray()
    },
    [activeTripId],
    [],
  )

  const { value: activities = [] } = useLiveQuery<AppActivity[]>(
    async () => {
      if (!activeTripId) return []
      return await db.actividades.where('trip_id').equals(activeTripId).filter((a) => a.deleted_at == null).toArray()
    },
    [activeTripId],
    [],
  )

  const stageSet = useMemo(() => new Set(countries.map((c) => c.code)), [countries])
  const invalidExpenses = useMemo(() => expenses.filter((e) => !stageSet.has(e.stage)), [expenses, stageSet])

  async function fixInvalidExpenseStages() {
    if (!activeTripId) return
    if (invalidExpenses.length === 0) return
    const fallback = countries[0]?.code ?? 'COLOMBIA'
    const ts = nowIso()
    setFixing(true)
    try {
      await db.transaction('rw', [db.gastos, db.itinerarios, db.hospedajes, db.actividades, db.outbox], async () => {
        for (const e of invalidExpenses) {
          const computed = stageForYmd(e.date, segments, fallback)
          const nextStage = stageSet.has(computed) ? computed : fallback
          if (!nextStage || e.stage === nextStage) continue

          const updatedE: AppExpense = { ...e, stage: nextStage, updated_at: ts }
          await db.gastos.put(updatedE)
          await db.outbox.add({
            id: newId(),
            table_name: 'gastos',
            op: 'UPSERT',
            entity_id: updatedE.id,
            payload: updatedE,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })

          const it = await db.itinerarios.get(e.id)
          if (it && it.deleted_at == null && it.trip_id === activeTripId && it.stage !== nextStage) {
            const updatedI: AppItinerary = { ...it, stage: nextStage, updated_at: ts }
            await db.itinerarios.put(updatedI)
            await db.outbox.add({
              id: newId(),
              table_name: 'itinerarios',
              op: 'UPSERT',
              entity_id: updatedI.id,
              payload: updatedI,
              created_at: ts,
              try_count: 0,
              last_error: null,
            })
          }

          const l = await db.hospedajes.get(e.id)
          if (l && l.deleted_at == null && l.trip_id === activeTripId && l.stage !== nextStage) {
            const updatedL: AppLodging = { ...l, stage: nextStage, updated_at: ts }
            await db.hospedajes.put(updatedL)
            await db.outbox.add({
              id: newId(),
              table_name: 'hospedajes',
              op: 'UPSERT',
              entity_id: updatedL.id,
              payload: updatedL,
              created_at: ts,
              try_count: 0,
              last_error: null,
            })
          }

          const a = await db.actividades.get(e.id)
          if (a && a.deleted_at == null && a.trip_id === activeTripId && a.stage !== nextStage) {
            const updatedA: AppActivity = { ...a, stage: nextStage, updated_at: ts }
            await db.actividades.put(updatedA)
            await db.outbox.add({
              id: newId(),
              table_name: 'actividades',
              op: 'UPSERT',
              entity_id: updatedA.id,
              payload: updatedA,
              created_at: ts,
              try_count: 0,
              last_error: null,
            })
          }
        }
      })
    } finally {
      setFixing(false)
    }
  }

  const issues = useMemo<Issue[]>(() => {
    const res: Issue[] = []

    const countryCodes = countries.map((c) => String(c.code ?? '').trim())
    const emptyCodes = countries.filter((c) => !String(c.code ?? '').trim()).map((c) => c.name)
    if (emptyCodes.length > 0) {
      res.push({
        key: 'countries_empty_code',
        title: 'Países sin código interno',
        severity: 'error',
        lines: emptyCodes.slice(0, 15).map((n) => `• ${n}`),
      })
    }

    const dupeMap = new Map<string, number>()
    for (const code of countryCodes) {
      if (!code) continue
      dupeMap.set(code, (dupeMap.get(code) ?? 0) + 1)
    }
    const dupes = Array.from(dupeMap.entries()).filter(([, n]) => n > 1).map(([c]) => c)
    if (dupes.length > 0) {
      res.push({
        key: 'countries_duplicate_code',
        title: 'Países con código duplicado',
        severity: 'error',
        lines: dupes.slice(0, 15).map((c) => `• ${c}`),
      })
    }

    if (segments.length > 1) {
      const ordered = segments.slice().sort((a, b) => a.startYmd.localeCompare(b.startYmd))
      const overlaps: string[] = []
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1]!
        const cur = ordered[i]!
        if (cur.startYmd <= prev.endYmd) {
          overlaps.push(`• ${prev.startYmd}–${prev.endYmd} solapa con ${cur.startYmd}–${cur.endYmd}`)
        }
      }
      if (overlaps.length > 0) {
        res.push({ key: 'segments_overlap', title: 'Tramos solapados', severity: 'error', lines: overlaps.slice(0, 15) })
      }
    }

    const invalidStages = invalidExpenses.map((e) => `• ${e.date} ${e.stage} (${e.description || e.id})`)
    if (invalidStages.length > 0) {
      res.push({ key: 'expenses_invalid_stage', title: 'Gastos con país/tramo inválido', severity: 'warn', lines: invalidStages.slice(0, 15) })
    }

    const catById = new Map(categories.map((c) => [c.id, c] as const))
    const expenseIds = new Set(expenses.map((e) => e.id))
    const itinIds = new Set(itineraries.map((i) => i.id))
    const lodgingIds = new Set(lodgings.map((h) => h.id))
    const activityIds = new Set(activities.map((a) => a.id))

    const orphanMirror: string[] = []
    for (const e of expenses) {
      const kind = (catById.get(e.category_id)?.kind ?? null) as CategoryKind | null
      if (!kind) continue
      if (kind === 'TRANSPORTE' && !itinIds.has(e.id)) orphanMirror.push(`• Gasto TRANSPORTE sin ruta (id ${e.id})`)
      if (kind === 'HOSPEDAJE' && !lodgingIds.has(e.id)) orphanMirror.push(`• Gasto HOSPEDAJE sin hospedaje (id ${e.id})`)
      if (kind === 'ENTRETENIMIENTO' && !activityIds.has(e.id)) orphanMirror.push(`• Gasto ENTRETENIMIENTO sin actividad (id ${e.id})`)
    }
    if (orphanMirror.length > 0) {
      res.push({ key: 'mirror_orphans', title: 'Gastos espejo sin origen', severity: 'warn', lines: orphanMirror.slice(0, 15) })
    }

    const missingExpenseMirror: string[] = []
    for (const i of itineraries) if (!expenseIds.has(i.id)) missingExpenseMirror.push(`• Ruta sin gasto espejo (id ${i.id})`)
    for (const h of lodgings) if (!expenseIds.has(h.id)) missingExpenseMirror.push(`• Hospedaje sin gasto espejo (id ${h.id})`)
    for (const a of activities) if (!expenseIds.has(a.id)) missingExpenseMirror.push(`• Actividad sin gasto espejo (id ${a.id})`)
    if (missingExpenseMirror.length > 0) {
      res.push({ key: 'mirror_missing_expense', title: 'Orígenes sin gasto espejo (puede ser válido si no hay costo)', severity: 'warn', lines: missingExpenseMirror.slice(0, 15) })
    }

    if (tripStartYmd && tripEndYmd) {
      const outOfTrip: string[] = []
      for (const e of expenses) if (e.date < tripStartYmd || e.date > tripEndYmd) outOfTrip.push(`• Gasto fuera del viaje: ${e.date} (${e.description || e.id})`)
      for (const i of itineraries) if (i.date < tripStartYmd || i.date > tripEndYmd) outOfTrip.push(`• Ruta fuera del viaje: ${i.date} (${i.title || i.id})`)
      for (const a of activities) if (a.date < tripStartYmd || a.date > tripEndYmd) outOfTrip.push(`• Actividad fuera del viaje: ${a.date} (${a.title || a.id})`)
      for (const h of lodgings) {
        if (h.check_in < tripStartYmd || h.check_in > tripEndYmd) outOfTrip.push(`• Check-in fuera del viaje: ${h.check_in} (${h.name || h.id})`)
        if (h.check_out < tripStartYmd || h.check_out > tripEndYmd) outOfTrip.push(`• Check-out fuera del viaje: ${h.check_out} (${h.name || h.id})`)
      }
      if (outOfTrip.length > 0) {
        res.push({ key: 'out_of_trip', title: 'Registros fuera del rango del viaje', severity: 'warn', lines: outOfTrip.slice(0, 15) })
      }
    }

    return res
  }, [activities, categories, countries, expenses, invalidExpenses, itineraries, lodgings, segments, tripEndYmd, tripStartYmd])

  return (
    <Page>
      <div className="mb-4">
        <div className="text-xs text-zinc-400">Calidad de datos</div>
        <div className="text-base font-semibold">Salud de datos</div>
      </div>

      {!activeTripId ? (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-400">Selecciona un viaje.</div>
      ) : issues.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          No se detectan problemas.
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((it) => (
            <div key={it.key} className={`rounded-2xl border bg-zinc-950/40 p-4 ${it.severity === 'error' ? 'border-rose-900/50' : 'border-zinc-900'}`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm font-semibold ${it.severity === 'error' ? 'text-rose-200' : 'text-zinc-100'}`}>{it.title}</div>
                <div className="text-xs text-zinc-500">{it.severity === 'error' ? 'Error' : 'Aviso'}</div>
              </div>
              {it.key === 'expenses_invalid_stage' && invalidExpenses.length > 0 ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    Arregla esto reasignando el país según los tramos del viaje.
                  </div>
                  <button
                    type="button"
                    onClick={() => void fixInvalidExpenseStages()}
                    disabled={fixing}
                    className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
                  >
                    {fixing ? 'Arreglando…' : 'Arreglar'}
                  </button>
                </div>
              ) : null}
              <div className="mt-2 whitespace-pre-line text-xs text-zinc-400">{it.lines.join('\n')}</div>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
