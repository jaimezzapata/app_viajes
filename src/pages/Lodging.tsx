import Page from '@/components/Page'
import { db } from '@/db/appDb'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import type { AppCategory, AppExpense, AppLodging, CountryStage } from '@/../shared/types'
import { useEffect, useMemo, useState } from 'react'
import { nowIso, newId } from '@/utils/id'
import { toYmd } from '@/utils/date'
import LodgingModal, { toLodgingFormState, type LodgingFormState } from '@/components/LodgingModal'
import { useTripStore } from '@/stores/tripStore'
import TripConfigModal from '@/components/TripConfigModal'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react'

export default function Lodging() {
  const [open, setOpen] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const countries = useTripStore((s) => s.countries)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const [tripOpen, setTripOpen] = useState(false)
  const [openByStage, setOpenByStage] = useState<Record<string, boolean>>({})

  const { value: categories } = useLiveQuery<AppCategory[]>(
    async () => await db.categorias.filter((c) => c.deleted_at == null).toArray(),
    [],
    [],
  )

  const { value: lodgings = [] } = useLiveQuery<AppLodging[]>(
    async () => {
      if (!activeTripId) return []
      return await db.hospedajes
        .where('trip_id')
        .equals(activeTripId)
        .toArray()
        .then(arr => arr.filter((l) => l.deleted_at == null).sort((a, b) => b.check_in.localeCompare(a.check_in)))
    },
    [activeTripId],
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

  const today = useMemo(() => toYmd(new Date()), [])
  const [form, setForm] = useState<LodgingFormState>(() => toLodgingFormState(today, countries))

  const stageOptions = useMemo(
    () => countries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [countries],
  )

  const lodgingsByStage = useMemo(() => {
    const map = new Map<CountryStage, AppLodging[]>()
    for (const l of lodgings) {
      const arr = map.get(l.stage) ?? []
      arr.push(l)
      map.set(l.stage, arr)
    }
    return map
  }, [lodgings])

  useEffect(() => {
    const next: Record<string, boolean> = { ...openByStage }
    for (const s of stageOptions) {
      if (next[s.stage] === undefined) next[s.stage] = true
    }
    setOpenByStage(next)
  }, [stageOptions])

  const orderedStages = useMemo(() => {
    const configured = stageOptions.map((s) => s.stage)
    const present = Array.from(lodgingsByStage.keys())
    const extra = present.filter((k) => !configured.includes(k)).sort((a, b) => a.localeCompare(b, 'es'))
    return [...configured, ...extra]
  }, [lodgingsByStage, stageOptions])

  const amountCop = useMemo(() => {
    const a = Number(form.amountOriginal.replace(',', '.'))
    const r = Number(form.fxRate.replace(',', '.'))
    if (!Number.isFinite(a) || !Number.isFinite(r)) return 0
    return Math.round(a * r)
  }, [form.amountOriginal, form.fxRate])

  const canSave = useMemo(() => {
    if (!form.stage) return false
    if (!form.name.trim()) return false
    if (!form.check_in) return false
    if (!form.check_out) return false
    if (form.check_out <= form.check_in) return false

    if (form.amountOriginal.trim() !== '') {
      const amount_original = Number(form.amountOriginal.replace(',', '.'))
      const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
      if (!Number.isFinite(amount_original) || amount_original <= 0) return false
      if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return false
    }

    return true
  }, [form.amountOriginal, form.check_in, form.check_out, form.fxRate, form.name, form.stage])

  const disabledReason = useMemo(() => {
    if (countries.length === 0) return 'Primero configura los países de tu viaje.'
    if (!form.stage) return 'Selecciona el país.'
    if (!form.name.trim()) return 'Agrega un nombre al lugar.'
    if (!form.check_in) return 'Selecciona el check-in.'
    if (!form.check_out) return 'Selecciona el check-out.'
    if (form.check_out <= form.check_in) return 'El check-out debe ser posterior al check-in.'
    
    if (form.amountOriginal.trim() !== '') {
      const amount_original = Number(form.amountOriginal.replace(',', '.'))
      if (!Number.isFinite(amount_original) || amount_original <= 0) return 'Monto inválido.'
      const fx_rate_to_cop = Number(form.fxRate.replace(',', '.'))
      if (!Number.isFinite(fx_rate_to_cop) || fx_rate_to_cop <= 0) return 'Tasa a COP inválida.'
    }

    return null
  }, [countries.length, form.amountOriginal, form.check_in, form.check_out, form.fxRate, form.name, form.stage])

  function handleNew() {
    setEditItemId(null)
    setForm(toLodgingFormState(today, countries))
    setOpen(true)
  }

  function handleEdit(l: AppLodging) {
    const exp = expensesById.get(l.id)
    setEditItemId(l.id)
    setForm(toLodgingFormState(today, countries, l, exp))
    setOpen(true)
  }

  async function onDelete() {
    if (!editItemId) return
    const ts = nowIso()
    try {
      const existingLodging = await db.hospedajes.get(editItemId)
      if (!existingLodging) return
      
      await db.transaction('rw', db.hospedajes, db.gastos, db.outbox, async () => {
        const updatedL: AppLodging = { ...existingLodging, deleted_at: ts, updated_at: ts }
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
      setOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  async function onSave() {
    setSaveError(null)
    if (!canSave || !activeTripId) return

    const ts = nowIso()
    
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
        const cat = categories.find((c) => c.kind === 'HOSPEDAJE' && c.subkind == null && c.deleted_at == null)
        if (!cat) throw new Error('No se encontró la categoría HOSPEDAJE para crear el gasto automático.')
        expenseCatId = cat.id
      }

      const id = editItemId || newId()

      const lodgingObj: AppLodging = {
        id,
        user_id: null,
        trip_id: activeTripId,
        stage: form.stage,
        name: form.name.trim(),
        city: form.city.trim(),
        check_in: form.check_in,
        check_out: form.check_out,
        address: form.address.trim(),
        notes: form.note.trim(),
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }

      // Preserve existing creation dates if editing
      if (editItemId) {
        const existL = await db.hospedajes.get(editItemId)
        if (existL) lodgingObj.created_at = existL.created_at
      }

      await db.transaction('rw', db.hospedajes, db.gastos, db.outbox, async () => {
        // 1. Save Lodging
        await db.hospedajes.put(lodgingObj)
        await db.outbox.add({
          id: newId(),
          table_name: 'hospedajes',
          op: 'UPSERT',
          entity_id: lodgingObj.id,
          payload: lodgingObj,
          created_at: ts,
          try_count: 0,
          last_error: null,
        })

        // 2. Save/Delete Expense Mirror
        if (wantsExpense && expenseCatId) {
          const expenseObj: AppExpense = {
            id,
            user_id: null,
            trip_id: activeTripId,
            date: form.check_in, // Assigning expense to check-in date
            stage: form.stage,
            category_id: expenseCatId,
            description: `Hospedaje: ${form.name.trim()}`,
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
          // If editing and they cleared the price, we delete the mirror expense if it existed.
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

    setOpen(false)
  }

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Tus reservas</div>
          <div className="text-base font-semibold">Hospedaje</div>
        </div>
        <div className="flex items-center gap-2">
          {countries.length === 0 ? (
            <button
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95"
              onClick={() => setTripOpen(true)}
              type="button"
            >
              Configurar viaje
            </button>
          ) : (
            <button
              className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              onClick={handleNew}
              type="button"
            >
              Nuevo
            </button>
          )}
        </div>
      </div>

      {countries.length === 0 ? (
        <div className="mb-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-300">
          Para registrar hospedajes primero configura los países de tu viaje.
        </div>
      ) : null}

      <div className="space-y-4">
        {orderedStages
          .map((stageKey) => {
            const items = lodgingsByStage.get(stageKey) ?? []
            if (items.length === 0) return null

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
                      <div className="text-[11px] text-zinc-400">{items.length} reserva{items.length === 1 ? '' : 's'}</div>
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
                      {items.map((l) => {
                        const exp = expensesById.get(l.id)
                        return (
                          <button
                            key={l.id}
                            type="button"
                            className="w-full text-left rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4 shadow-sm transition-all hover:bg-zinc-800/40 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                            onClick={() => handleEdit(l)}
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-zinc-100 mb-1">{l.name}</div>
                                {l.city || l.address ? (
                                  <div className="flex items-start gap-1.5 text-xs text-zinc-400 mb-3">
                                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <span>{[l.city, l.address].filter(Boolean).join(' · ')}</span>
                                  </div>
                                ) : null}

                                <div className="flex items-center gap-3">
                                  <div className="bg-zinc-950 rounded-xl px-2.5 py-2 border border-zinc-800 flex-1">
                                    <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5 font-mono">In</div>
                                    <div className="text-xs font-semibold text-sky-400">{l.check_in}</div>
                                  </div>
                                  <div className="bg-zinc-950 rounded-xl px-2.5 py-2 border border-zinc-800 flex-1">
                                    <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-0.5 font-mono">Out</div>
                                    <div className="text-xs font-semibold text-rose-400">{l.check_out}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-right shrink-0">
                                {exp ? (
                                  <div className="flex flex-col items-end">
                                    <div className="text-xs font-semibold text-sky-400">{formatCop(exp.amount_cop)}</div>
                                    <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                                       <CheckCircle2 className="h-3 w-3" /> Costo registrado
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-zinc-500 italic mt-1 bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-800/50">
                                    Sin costo registrado
                                  </div>
                                )}
                              </div>
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

        {lodgings.length === 0 ? (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 text-center text-sm text-zinc-400">
            Sin alojamientos registrados.
          </div>
        ) : null}
      </div>

      <LodgingModal
        open={open}
        onClose={() => setOpen(false)}
        countries={countries}
        form={form}
        setForm={setForm}
        amountCop={amountCop}
        onSave={onSave}
        canSave={canSave}
        disabledReason={disabledReason}
        errorMessage={saveError}
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
