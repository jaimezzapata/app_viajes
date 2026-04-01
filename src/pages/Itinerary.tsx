import Page from '@/components/Page'
import { useMemo, useState } from 'react'
import TripConfigModal from '@/components/TripConfigModal'
import { Settings, ChevronDown, ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import type { AppItinerary, AppExpense, AppCategory } from '@/../shared/types'
import { useTripStore } from '@/stores/tripStore'
import { toYmd } from '@/utils/date'
import { nowIso, newId } from '@/utils/id'
import ItineraryModal, { toFormState, toItineraryNotes, type ItineraryFormState } from '@/components/ItineraryModal'
import { parseItineraryNotes } from '@/itinerary/notes'

export default function Itinerary() {
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [openByStage, setOpenByStage] = useState<Record<string, boolean>>({})
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeTripId = useTripStore((s) => s.activeTripId)
  const countries = useTripStore((s) => s.countries)

  const { value: items = [] } = useLiveQuery<AppItinerary[]>(
    async () => {
      if (!activeTripId) return []
      return await db.itinerarios
        .where('trip_id')
        .equals(activeTripId)
        .toArray()
        .then(arr => arr.filter((i) => i.deleted_at == null).sort((a, b) => b.date.localeCompare(a.date)))
    },
    [activeTripId],
    [],
  )

  const { value: categories } = useLiveQuery<AppCategory[]>(
    async () => await db.categorias.filter((c) => c.deleted_at == null).toArray(),
    [],
    [],
  )

  const { value: expenses = [] } = useLiveQuery<AppExpense[]>(
    async () => {
      if (!activeTripId) return []
      return await db.gastos
        .where('trip_id')
        .equals(activeTripId)
        .toArray()
        .then(arr => arr.filter((e) => e.deleted_at == null))
    },
    [activeTripId],
    [],
  )

  const expensesById = useMemo(() => new Map(expenses.map((e) => [e.id, e])), [expenses])

  const stageOptions = useMemo(
    () => countries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [countries],
  )

  const itemsByStage = useMemo(() => {
    const map = new Map<string, AppItinerary[]>()
    for (const a of items) {
      const arr = map.get(a.stage) ?? []
      arr.push(a)
      map.set(a.stage, arr)
    }
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => {
        const d = a.date.localeCompare(b.date)
        if (d !== 0) return d
        return (a.start_time || '').localeCompare(b.start_time || '')
      })
    }
    return map
  }, [items])

  const orderedStages = useMemo(() => {
    const configured = stageOptions.map((s) => s.stage)
    const present = Array.from(itemsByStage.keys())
    const extra = present.filter((k) => !configured.includes(k)).sort((a, b) => a.localeCompare(b, 'es'))
    return [...configured, ...extra]
  }, [itemsByStage, stageOptions])

  const today = useMemo(() => toYmd(new Date()), [])
  const [form, setForm] = useState<ItineraryFormState>(() => toFormState(today, countries))

  const amountCop = useMemo(() => {
    const a = Number(form.amountOriginal.replace(',', '.'))
    const r = Number(form.fxRate.replace(',', '.'))
    if (!Number.isFinite(a) || !Number.isFinite(r)) return 0
    return Math.round(a * r)
  }, [form.amountOriginal, form.fxRate])

  const canSave = useMemo(() => {
    if (!form.date) return false
    if (!form.stage) return false
    if (!form.type) return false
    if (!form.title.trim() && !form.from_place.trim() && !form.to_place.trim()) return false

    if (form.amountOriginal.trim() !== '') {
      const amount_original = Number(form.amountOriginal.replace(',', '.'))
      const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
      if (!Number.isFinite(amount_original) || amount_original <= 0) return false
      if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return false
    }

    return true
  }, [form.amountOriginal, form.date, form.from_place, form.fxRate, form.stage, form.title, form.to_place, form.type])

  const disabledReason = useMemo(() => {
    if (!form.date) return 'Selecciona una fecha.'
    if (!form.stage) return 'Selecciona un país.'
    if (!form.type) return 'Selecciona un tipo.'
    if (!form.title.trim() && !form.from_place.trim() && !form.to_place.trim()) return 'Escribe un título o una ruta.'

    if (form.amountOriginal.trim() !== '') {
      const amount_original = Number(form.amountOriginal.replace(',', '.'))
      if (!Number.isFinite(amount_original) || amount_original <= 0) return 'Monto inválido.'
      const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
      if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return 'Tasa a COP inválida.'
    }

    return null
  }, [form.amountOriginal, form.date, form.from_place, form.fxRate, form.stage, form.title, form.to_place, form.type])

  function handleNew() {
    setEditItemId(null)
    setForm(toFormState(today, countries))
    setAddOpen(true)
  }

  function handleEdit(it: AppItinerary) {
    const exp = expensesById.get(it.id)
    setEditItemId(it.id)
    setForm(toFormState(today, countries, it, exp))
    setAddOpen(true)
  }

  async function onDelete() {
    if (!editItemId) return
    const ts = nowIso()
    try {
      const existing = await db.itinerarios.get(editItemId)
      if (!existing) return
      
      await db.transaction('rw', db.itinerarios, db.gastos, db.outbox, async () => {
        const updated: AppItinerary = { ...existing, deleted_at: ts, updated_at: ts }
        await db.itinerarios.put(updated)
        await db.outbox.add({
          id: newId(),
          table_name: 'itinerarios',
          op: 'UPSERT',
          entity_id: updated.id,
          payload: updated,
          created_at: ts,
          try_count: 0,
          last_error: null,
        })

        const existingExp = await db.gastos.get(editItemId)
        if (existingExp) {
          const updatedE: AppExpense = { ...existingExp, deleted_at: ts, updated_at: ts }
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
        }
      })
      setAddOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  async function onSave() {
    setSaveError(null)
    if (!canSave || !activeTripId) return

    const ts = nowIso()
    const title = form.title.trim() || [form.from_place.trim(), form.to_place.trim()].filter(Boolean).join(' → ') || 'Trayecto'

    let amount_original = 0
    let fx_rate_to_cop = 1
    let wantsExpense = false

    if (form.amountOriginal.trim() !== '') {
      amount_original = Number(form.amountOriginal.replace(',', '.'))
      fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
      wantsExpense = amountCop > 0
    }

    try {
      let expenseCatId: string | null = null
      if (wantsExpense) {
        const cat = categories.find((c) => c.kind === 'TRANSPORTE' && c.deleted_at == null)
        if (!cat) throw new Error('No se encontró la categoría TRANSPORTE para crear el gasto automático.')
        expenseCatId = cat.id
      }

      const id = editItemId || newId()

      const updated: AppItinerary = {
        id,
        user_id: null,
        trip_id: activeTripId,
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        stage: form.stage,
        type: form.type,
        title,
        from_place: form.from_place.trim() || null,
        to_place: form.to_place.trim() || null,
        notes: toItineraryNotes(form),
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }

      if (editItemId) {
        const existing = await db.itinerarios.get(editItemId)
        if (existing) updated.created_at = existing.created_at
      }

      await db.transaction('rw', db.itinerarios, db.gastos, db.outbox, async () => {
        // 1. Guardar Itinerario
        await db.itinerarios.put(updated)
        await db.outbox.add({
          id: newId(),
          table_name: 'itinerarios',
          op: 'UPSERT',
          entity_id: updated.id,
          payload: updated,
          created_at: ts,
          try_count: 0,
          last_error: null,
        })

        // 2. Guardar o Borrar Gasto espejo
        if (wantsExpense && expenseCatId) {
          const expenseObj: AppExpense = {
            id,
            user_id: null,
            trip_id: activeTripId,
            date: form.date,
            stage: form.stage,
            category_id: expenseCatId,
            description: `Transp: ${title}`,
            currency: form.currency,
            amount_original,
            fx_rate_to_cop,
            amount_cop: Math.round(amount_original * fx_rate_to_cop),
            created_at: ts,
            updated_at: ts,
            deleted_at: null,
          }
          if (editItemId) {
            const existE = await db.gastos.get(editItemId)
            if (existE) expenseObj.created_at = existE.created_at
          }

          await db.gastos.put(expenseObj)
          await db.outbox.add({
            id: newId(),
            table_name: 'gastos',
            op: 'UPSERT',
            entity_id: expenseObj.id,
            payload: expenseObj,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        } else if (editItemId) {
          const existE = await db.gastos.get(editItemId)
          if (existE && existE.deleted_at == null) {
            const delExp: AppExpense = { ...existE, deleted_at: ts, updated_at: ts }
            await db.gastos.put(delExp)
            await db.outbox.add({
              id: newId(),
              table_name: 'gastos',
              op: 'UPSERT',
              entity_id: delExp.id,
              payload: delExp,
              created_at: ts,
              try_count: 0,
              last_error: null,
            })
          }
        }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar.'
      setSaveError(message)
      return
    }

    setAddOpen(false)
    setForm(toFormState(today, countries))
  }

  const stageMeta = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries])
  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Viajes, tramos y rutas</div>
          <div className="text-base font-semibold">Itinerario</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            type="button"
            onClick={handleNew}
          >
            Nuevo
          </button>
          <button
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
            type="button"
            onClick={() => setOpen(true)}
          >
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurar
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-4 pb-24">
        {orderedStages.map((stageKey) => {
          const catItems = itemsByStage.get(stageKey) ?? []
          if (catItems.length === 0) return null

          const meta = stageOptions.find((s) => s.stage === stageKey)
          const label = meta?.label ?? stageKey
          const flag = meta?.flag ?? '🏳️'
          const isOpen = openByStage[stageKey] ?? true

          return (
            <div key={stageKey} className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40 shadow-sm shadow-black/20">
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3"
                type="button"
                onClick={() => setOpenByStage((s) => ({ ...s, [stageKey]: !(s[stageKey] ?? true) }))}
              >
                <div className="flex items-center gap-2">
                  <div className="text-base leading-none">{flag}</div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-zinc-100">{label}</div>
                    <div className="text-[11px] text-zinc-400">{catItems.length} trayectos/rutas</div>
                  </div>
                </div>
                <div className="text-zinc-300">{isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    className="space-y-2 px-3 pb-3"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    {catItems.map((it) => {
                      const notes = parseItineraryNotes(it.notes)
                      const isFlight = it.type === 'VUELO'
                      const stops = (notes.stops ?? []).filter(Boolean)
                      const airlines = (notes.airlines ?? []).filter(Boolean)
                      return (
                        <button
                          key={it.id}
                          type="button"
                          className="w-full text-left rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 shadow-sm transition-colors hover:border-zinc-700/80 hover:bg-zinc-800/20 block focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                          onClick={() => handleEdit(it)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-400 font-medium bg-zinc-800/40 px-2 py-0.5 rounded-xl border border-zinc-800">
                                  {it.date}
                                </span>
                                {it.start_time ? <div className="text-[11px] text-zinc-400 font-medium">{it.start_time}{it.end_time ? `–${it.end_time}` : ''}</div> : null}
                              </div>

                              <div className="mt-2 text-sm font-semibold text-zinc-100">{it.title}</div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                                {[it.from_place, it.to_place].filter(Boolean).join(' → ') || it.type}
                              </div>

                              {isFlight ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300">Vuelo</span>
                                  <span className="rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300">
                                    {stops.length === 0 ? 'Directo' : `Escala: ${stops.join(' · ')}`}
                                  </span>
                                  {airlines.length > 0 ? (
                                    <span className="rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300">Aerolínea: {airlines.join(' · ')}</span>
                                  ) : null}
                                </div>
                              ) : null}

                              {notes.note ? <div className="mt-2 text-xs text-zinc-400">{notes.note}</div> : null}
                            </div>

                            <div className="text-[11px] text-zinc-400 shrink-0">{it.type}</div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-8 text-center text-sm text-zinc-400">
            Sin trayectos todavía.
          </div>
        ) : null}
      </div>
      <TripConfigModal open={open} onClose={() => setOpen(false)} />
      <ItineraryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        countries={countries}
        form={form}
        setForm={setForm}
        onSave={onSave}
        canSave={canSave}
        disabledReason={disabledReason}
        errorMessage={saveError}
        isEditing={!!editItemId}
        onDelete={onDelete}
        amountCop={amountCop}
      />
    </Page>
  )
}
