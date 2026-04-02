import Page from '@/components/Page'
import { db } from '@/db/appDb'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import type { AppCategory, AppExpense, AppLodging, CountryStage } from '@/../shared/types'
import { useEffect, useMemo, useState } from 'react'
import { nowIso, newId } from '@/utils/id'
import { toYmd } from '@/utils/date'
import CategoryPill from '@/components/CategoryPill'
import ExpenseModal from '@/components/ExpenseModal'
import type { ExpenseFormState } from '@/types/expenses'
import { stageForYmd, useTripStore } from '@/stores/tripStore'
import TripConfigModal from '@/components/TripConfigModal'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useDynamicHead } from '@/hooks/useDynamicHead'
import FlagAvatar from '@/components/FlagAvatar'

type FormState = ExpenseFormState

export default function Expenses() {
  useDynamicHead('Gastos', 'Receipt')
  const [open, setOpen] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const countries = useTripStore((s) => s.countries)
  const segments = useTripStore((s) => s.segments)
  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const [tripOpen, setTripOpen] = useState(false)
  const [openByStage, setOpenByStage] = useState<Record<string, boolean>>({})

  const { value: categories, error: categoriesError } = useLiveQuery<AppCategory[]>(
    async () => await db.categorias.filter((c) => c.deleted_at == null).toArray(),
    [],
    [],
  )

  const today = useMemo(() => toYmd(new Date()), [])
  const [form, setForm] = useState<FormState>(() => ({
    date: today,
    stage: 'COLOMBIA',
    stageMode: 'AUTO',
    categoryKind: 'HOSPEDAJE',
    categoryId: '',
    description: '',
    currency: 'COP',
    amountOriginal: '',
    fxRate: '1',
  }))

  const { value: expenses = [] } = useLiveQuery<AppExpense[]>(
    async () => {
      if (!activeTripId) return []
      return await db.gastos
        .where('trip_id')
        .equals(activeTripId)
        .toArray()
        .then(arr => arr.filter((e) => e.deleted_at == null).sort((a, b) => b.date.localeCompare(a.date)))
    },
    [activeTripId],
    [],
  )

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const stageOptions = useMemo(
    () => countries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag, acronym: c.acronym })),
    [countries],
  )

  const expensesByStage = useMemo(() => {
    const map = new Map<CountryStage, AppExpense[]>()
    for (const e of expenses) {
      const arr = map.get(e.stage) ?? []
      arr.push(e)
      map.set(e.stage, arr)
    }
    return map
  }, [expenses])

  useEffect(() => {
    const next: Record<string, boolean> = { ...openByStage }
    for (const s of stageOptions) {
      if (next[s.stage] === undefined) next[s.stage] = true
    }
    setOpenByStage(next)
  }, [stageOptions])

  const orderedStages = useMemo(() => {
    const configured = stageOptions.map((s) => s.stage)
    const present = Array.from(expensesByStage.keys())
    const extra = present.filter((k) => !configured.includes(k)).sort((a, b) => a.localeCompare(b, 'es'))
    return [...configured, ...extra]
  }, [expensesByStage, stageOptions])

  const amountCop = useMemo(() => {
    const a = Number(form.amountOriginal.replace(',', '.'))
    const r = Number(form.fxRate.replace(',', '.'))
    if (!Number.isFinite(a) || !Number.isFinite(r)) return 0
    return Math.round(a * r)
  }, [form.amountOriginal, form.fxRate])

  const tripReady = useMemo(() => {
    if (!tripStartYmd || !tripEndYmd) return false
    if (tripStartYmd > tripEndYmd) return false
    if (segments.length === 0) return false
    return true
  }, [segments.length, tripEndYmd, tripStartYmd])

  const hasSegmentForDate = useMemo(() => {
    if (!form.date) return false
    return segments.some((s) => s.startYmd <= form.date && form.date <= s.endYmd)
  }, [form.date, segments])

  useEffect(() => {
    if (form.categoryId) return
    const primary = categories.find((c) => c.kind === form.categoryKind && c.subkind == null && c.deleted_at == null)
    if (primary) {
      setForm((f) => ({ ...f, categoryId: primary.id }))
      return
    }
    const firstSub = categories.find((c) => c.kind === form.categoryKind && c.subkind != null && c.deleted_at == null)
    if (firstSub) {
      setForm((f) => ({ ...f, categoryId: firstSub.id }))
    }
  }, [categories, form.categoryId, form.categoryKind])

  const canSave = useMemo(() => {
    const amount_original = Number(form.amountOriginal.replace(',', '.'))
    const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
    if (!tripReady) return false
    if (!form.date) return false
    if (form.date < tripStartYmd || form.date > tripEndYmd) return false
    if (form.stageMode === 'AUTO' && !hasSegmentForDate) return false
    if (!form.categoryId) return false
    if (!Number.isFinite(amount_original) || amount_original <= 0) return false
    if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return false
    return true
  }, [form.amountOriginal, form.categoryId, form.date, form.fxRate, form.stageMode, hasSegmentForDate, tripEndYmd, tripReady, tripStartYmd])

  const disabledReason = useMemo(() => {
    if (!tripReady || !activeTripId) return 'Primero configura el viaje (países y tramos).'
    if (categories.length === 0) return 'No hay categorías cargadas.'
    if (!form.date) return 'Selecciona una fecha.'
    if (form.date < tripStartYmd || form.date > tripEndYmd) return 'La fecha debe estar dentro del viaje.'
    if (form.stageMode === 'AUTO' && !hasSegmentForDate) return 'No hay un tramo configurado para esa fecha.'
    if (!form.categoryId) return 'Selecciona una categoría.'
    const amount_original = Number(form.amountOriginal.replace(',', '.'))
    if (!Number.isFinite(amount_original) || amount_original <= 0) return 'Ingresa un monto válido.'
    const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
    if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return 'Ingresa una tasa válida a COP.'
    return null
  }, [categories.length, form.amountOriginal, form.categoryId, form.date, form.fxRate, form.stageMode, hasSegmentForDate, tripEndYmd, tripReady, tripStartYmd])

  function handleNew() {
    setEditItemId(null)
    setForm({
      date: today,
      stage: 'COLOMBIA',
      stageMode: 'AUTO',
      categoryKind: 'HOSPEDAJE',
      categoryId: '',
      description: '',
      currency: 'COP',
      amountOriginal: '',
      fxRate: '1',
    })
    setOpen(true)
  }

  function handleEdit(e: AppExpense) {
    const cat = byId.get(e.category_id)
    setEditItemId(e.id)
    setForm({
      date: e.date,
      stage: e.stage,
      stageMode: 'MANUAL',
      categoryKind: cat?.kind ?? 'HOSPEDAJE',
      categoryId: e.category_id,
      description: e.description,
      currency: e.currency,
      amountOriginal: e.amount_original.toString().replace('.', ','),
      fxRate: e.fx_rate_to_cop.toString().replace('.', ','),
    })
    setOpen(true)
  }

  async function onDelete() {
    if (!editItemId) return
    const ts = nowIso()
    try {
      const existing = await db.gastos.get(editItemId)
      if (!existing) return
      
      const updated: AppExpense = { ...existing, deleted_at: ts, updated_at: ts }
      const maybeLodging = await db.hospedajes.get(editItemId)
      const shouldCascadeLodging =
        !!maybeLodging && maybeLodging.deleted_at == null && maybeLodging.trip_id === existing.trip_id

      await db.transaction('rw', db.gastos, db.hospedajes, db.outbox, async () => {
        await db.gastos.put(updated)
        await db.outbox.add({
          id: newId(),
          table_name: 'gastos',
          op: 'UPSERT',
          entity_id: updated.id,
          payload: updated,
          created_at: ts,
          try_count: 0,
          last_error: null,
        })

        if (shouldCascadeLodging) {
          const updatedL: AppLodging = { ...(maybeLodging as AppLodging), deleted_at: ts, updated_at: ts }
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
      })
      setOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  async function onSave() {
    setSaveError(null)
    if (!tripReady || !activeTripId) {
      setSaveError('Primero configura el viaje.')
      return
    }
    if (categories.length === 0) {
      setSaveError('No hay categorías cargadas todavía.')
      return
    }

    const amount_original = Number(form.amountOriginal.replace(',', '.'))
    const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
    if (!form.date) {
      setSaveError('Selecciona una fecha.')
      return
    }
    if (form.date < tripStartYmd || form.date > tripEndYmd) {
      setSaveError('La fecha debe estar dentro del viaje.')
      return
    }
    if (form.stageMode === 'AUTO' && !hasSegmentForDate) {
      setSaveError('No hay un tramo configurado para esa fecha.')
      return
    }
    if (!form.categoryId) {
      setSaveError('Selecciona una categoría.')
      return
    }
    if (!Number.isFinite(amount_original) || amount_original <= 0) {
      setSaveError('Ingresa un monto válido.')
      return
    }
    if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) {
      setSaveError('Ingresa una tasa válida a COP.')
      return
    }

    const ts = nowIso()
    const stage = form.stageMode === 'AUTO' ? stageForYmd(form.date, segments, form.stage) : form.stage

    try {
      if (editItemId) {
        const existing = await db.gastos.get(editItemId)
        if (!existing) throw new Error('No se encontró el gasto para editar.')

        const updated: AppExpense = {
          ...existing,
          date: form.date,
          stage,
          category_id: form.categoryId,
          description: form.description.trim(),
          currency: form.currency,
          amount_original,
          fx_rate_to_cop,
          amount_cop: Math.round(amount_original * fx_rate_to_cop),
          updated_at: ts,
        }

        await db.transaction('rw', db.gastos, db.outbox, async () => {
          await db.gastos.put(updated)
          await db.outbox.add({
            id: newId(),
            table_name: 'gastos',
            op: 'UPSERT',
            entity_id: updated.id,
            payload: updated,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        })
      } else {
        const item: AppExpense = {
          id: newId(),
          user_id: null,
          trip_id: activeTripId,
          date: form.date,
          stage,
          category_id: form.categoryId,
          description: form.description.trim(),
          currency: form.currency,
          amount_original,
          fx_rate_to_cop,
          amount_cop: Math.round(amount_original * fx_rate_to_cop),
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        }

        await db.transaction('rw', db.gastos, db.outbox, async () => {
          await db.gastos.add(item)
          await db.outbox.add({
            id: newId(),
            table_name: 'gastos',
            op: 'UPSERT',
            entity_id: item.id,
            payload: item,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar.'
      setSaveError(message)
      return
    }

    setOpen(false)
    setForm((f) => ({ ...f, description: '', amountOriginal: '' }))
  }

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Registro rápido</div>
          <div className="text-base font-semibold">Gastos</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {categories.length} categorías {categoriesError ? '· error cargando categorías' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!tripReady ? (
            <button
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95"
              onClick={() => setTripOpen(true)}
              type="button"
            >
              Configurar viaje
            </button>
          ) : (
            <button
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95"
              onClick={handleNew}
              type="button"
            >
              Nuevo
            </button>
          )}
        </div>
      </div>

      {!tripReady ? (
        <div className="mb-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-300">
          Para registrar gastos primero configura el viaje: agrega los países y define los tramos por fechas.
        </div>
      ) : null}

      <div className="space-y-2">
        {orderedStages
          .map((stageKey) => {
            const items = expensesByStage.get(stageKey) ?? []
            if (items.length === 0) return null

            const meta = stageOptions.find((s) => s.stage === stageKey)
            const label = meta?.label ?? stageKey
            const cca2 = meta?.acronym
            const total = items.reduce((acc, e) => acc + e.amount_cop, 0)
            const isOpen = openByStage[stageKey] ?? true

            return (
              <div key={stageKey} className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40 shadow-sm shadow-black/20">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3"
                  type="button"
                  onClick={() => setOpenByStage((s) => ({ ...s, [stageKey]: !(s[stageKey] ?? true) }))}
                >
                  <div className="flex items-center gap-2">
                    <FlagAvatar cca2={cca2} />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-zinc-100">{label}</div>
                      <div className="text-[11px] text-zinc-400">{items.length} movimientos · {formatCop(total)}</div>
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
                      {items.map((e) => {
                        const cat = byId.get(e.category_id)
                        return (
                          <button
                            key={e.id}
                            type="button"
                            className="w-full text-left rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 shadow-sm transition-colors hover:border-zinc-700/80 hover:bg-zinc-800/20 block focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                            onClick={() => handleEdit(e)}
                          >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {cat ? <CategoryPill label={cat.name} color={cat.color} iconName={cat.icon} /> : null}
                                    <div className="text-xs text-zinc-400">{e.date}</div>
                                  </div>
                                <div className="mt-2 text-sm text-zinc-100">{e.description || 'Sin descripción'}</div>
                                <div className="mt-1 text-xs text-zinc-400">
                                  {formatMoney(e.amount_original, e.currency)} · tasa {e.fx_rate_to_cop} · {formatCop(e.amount_cop)}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-zinc-100">{formatCop(e.amount_cop)}</div>
                            </div>
                          </button>
                        )
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })
          .filter(Boolean)}

        {expenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-8 text-center text-sm text-zinc-400">
            Sin gastos todavía.
          </div>
        ) : null}
      </div>

      <ExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        form={form}
        setForm={setForm}
        amountCop={amountCop}
        onSave={onSave}
        canSave={canSave}
        disabledReason={disabledReason}
        errorMessage={saveError ?? (categoriesError instanceof Error ? categoriesError.message : categoriesError ? 'Error cargando categorías.' : null)}
        isEditing={!!editItemId}
        onDelete={onDelete}
      />

      <TripConfigModal open={tripOpen} onClose={() => setTripOpen(false)} />
    </Page>
  )
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}
