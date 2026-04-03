import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { parseYmd, toYmd } from '@/utils/date'
import type { AppActivity, ActivityType, AppExpense } from '@/../shared/types'
import { formatFxRate, getRateToCop } from '@/fx/fx'
import FlagAvatar from '@/components/FlagAvatar'
import SheetSelect from '@/components/SheetSelect'

const types: { val: ActivityType; label: string; bg: string; text: string }[] = [
  { val: 'MUSEO', label: 'Museo / Atracción', bg: 'bg-violet-500/20', text: 'text-violet-300' },
  { val: 'RESTAURANTE', label: 'Restaurante / Bar', bg: 'bg-orange-500/20', text: 'text-orange-300' },
  { val: 'TOUR', label: 'Tour Guiado', bg: 'bg-sky-500/20', text: 'text-sky-300' },
  { val: 'EVENTO', label: 'Concierto / Evento', bg: 'bg-rose-500/20', text: 'text-rose-300' },
  { val: 'COMPRAS', label: 'Compras', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  { val: 'OTRO', label: 'Otro', bg: 'bg-slate-500/20', text: 'text-slate-300' },
]

export default function ActivityModal({
  open,
  onClose,
  existingItem,
}: {
  open: boolean
  onClose: () => void
  existingItem?: AppActivity | null
}) {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const segments = useTripStore((s) => s.segments)
  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const selectedYmd = useTripStore((s) => s.selectedYmd)
  const countries = useTripStore((s) => s.countries)
  const isNational = useTripStore((s) => s.isNational)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const fxTouchedRef = useRef(false)
  const currencyTouchedRef = useRef(false)

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [stage, setStage] = useState('')
  const [type, setType] = useState<ActivityType>('TOUR')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const [currency, setCurrency] = useState('COP')
  const [fxRate, setFxRate] = useState('1')
  const [amountOriginal, setAmountOriginal] = useState('0')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const stageOptions = useMemo(
    () =>
      countries.map((c) => ({
        stage: c.code,
        label: c.name,
        currency: c.currency,
        cca2: c.acronym,
      })),
    [countries],
  )

  const currencyOptions = useMemo(() => {
    const set = new Set<string>()
    set.add('COP')
    for (const c of countries) {
      const cur = String(c.currency ?? '').trim().toUpperCase()
      if (cur) set.add(cur)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [countries])

  const stageToCurrency = useMemo(() => new Map(stageOptions.map((o) => [o.stage, o.currency] as const)), [stageOptions])

  function setCurrencyTouched(next: string) {
    currencyTouchedRef.current = true
    setCurrency(next)
  }

  async function prefillFx(nextCurrency: string, ymd: string) {
    if (fxTouchedRef.current) return
    if (nextCurrency === 'COP') {
      setFxRate('1')
      return
    }
    if (!ymd) return
    try {
      const fx = await getRateToCop(nextCurrency, ymd)
      const txt = formatFxRate(fx.rate)
      if (!txt) return
      setFxRate((prev) => (fxTouchedRef.current ? prev : txt))
    } catch {
      return
    }
  }

  useEffect(() => {
    if (!open) return
    if (existingItem) {
      setDate(existingItem.date)
      setStartTime(existingItem.start_time || '')
      setEndTime(existingItem.end_time || '')
      setStage(existingItem.stage)
      setType(existingItem.type)
      setTitle(existingItem.title)
      setLocation(existingItem.location || '')
      setNotes(existingItem.notes)

      fxTouchedRef.current = false
      currencyTouchedRef.current = false

      void db.gastos.get(existingItem.id).then((exp) => {
        if (!exp) {
          const expected = stageToCurrency.get(existingItem.stage) ?? 'COP'
          setCurrency(expected)
          setFxRate('1')
          setAmountOriginal('0')
          return
        }
        setCurrency(exp.currency ?? (stageToCurrency.get(existingItem.stage) ?? 'COP'))
        setFxRate(String(exp.fx_rate_to_cop ?? 1))
        setAmountOriginal(String(exp.amount_original ?? 0))
      })
    } else {
      let candidateDate = selectedYmd || tripStartYmd || toYmd(new Date())
      setDate(candidateDate)
      setStartTime('')
      setEndTime('')
      
      const cd = parseYmd(candidateDate)
      const cTime = cd.getTime()
      let bestStage = segments[0]?.fromStage || countries[0]?.code || ''
      for (const seg of segments) {
        const segSt = parseYmd(seg.startYmd).getTime()
        const segEd = parseYmd(seg.endYmd).getTime()
        if (cTime >= segSt && cTime <= segEd) {
          bestStage = seg.fromStage
          break
        }
      }
      setStage(bestStage)
      setType('TOUR')
      setTitle('')
      setLocation('')
      setNotes('')

      fxTouchedRef.current = false
      currencyTouchedRef.current = false
      const expected = stageToCurrency.get(bestStage) ?? 'COP'
      setCurrency(isNational ? 'COP' : expected)
      setFxRate('1')
      setAmountOriginal('0')
    }
  }, [open, existingItem, selectedYmd, tripStartYmd, segments, countries, isNational, stageToCurrency])

  useEffect(() => {
    if (existingItem) return
    const cd = parseYmd(date)
    const cTime = cd.getTime()
    let bestStage = segments[0]?.fromStage || countries[0]?.code || ''
    for (const seg of segments) {
      const segSt = parseYmd(seg.startYmd).getTime()
      const segEd = parseYmd(seg.endYmd).getTime()
      if (cTime >= segSt && cTime <= segEd) {
        bestStage = seg.fromStage
        break
      }
    }
    setStage(bestStage)
  }, [date, segments, countries, existingItem])

  useEffect(() => {
    if (!open) return
    if (existingItem) return
    if (currencyTouchedRef.current) return
    const expected = stageToCurrency.get(stage)
    if (!expected) return
    setCurrency(isNational ? 'COP' : expected)
  }, [existingItem, isNational, open, stage, stageToCurrency])

  useEffect(() => {
    if (!open) return
    fxTouchedRef.current = false
    void prefillFx(currency, date)
  }, [open])

  useEffect(() => {
    if (!open) return
    void prefillFx(currency, date)
  }, [currency, date, open])

  async function onSave() {
    if (!title.trim() || !activeTripId) return

    const ts = nowIso()
    const id = existingItem?.id || newId()

    const item: AppActivity = {
      id,
      user_id: null,
      trip_id: activeTripId,
      date,
      start_time: startTime || null,
      end_time: endTime || null,
      stage,
      type,
      title: title.trim(),
      location: location.trim() || null,
      booking_refs: existingItem?.booking_refs ?? null,
      notes: notes.trim(),
      created_at: existingItem?.created_at || ts,
      updated_at: ts,
      deleted_at: null,
    }

    const parsedAmount = parseFloat(String(amountOriginal ?? '').replace(/[^0-9.-]/g, ''))
    const finalAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : parsedAmount
    const parsedFx = parseFloat(String(fxRate ?? '').replace(/[^0-9.-]/g, ''))
    const finalFx = isNational || currency === 'COP' ? 1 : isNaN(parsedFx) || parsedFx <= 0 ? 1 : parsedFx
    const amountCop = Math.round(finalAmount * finalFx)

    await db.transaction('rw', [db.actividades, db.gastos, db.categorias, db.outbox, db.meta], async () => {
      await db.actividades.put(item)
      await db.outbox.add({
        id: newId(),
        table_name: 'actividades',
        op: 'UPSERT',
        entity_id: id,
        payload: item,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })

      // Get category
      let tCatId = ''
      const categories = await db.categorias.toArray()
      let tCat = categories.find((c) => c.kind === 'ENTRETENIMIENTO' && c.subkind === 'GENERAL' && c.deleted_at == null)
      if (tCat) {
        tCatId = tCat.id
      } else {
        tCatId = newId()
        const emergencyCat = {
          id: tCatId,
          user_id: null,
          kind: 'ENTRETENIMIENTO' as const,
          subkind: 'GENERAL' as const,
          name: 'Entretenimiento/Actividades',
          color: '#ec4899',
          icon: 'Ticket',
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        }
        await db.categorias.put(emergencyCat)
      }

      const expId = id // Bind exactly to the activity ID
      const existE = await db.gastos.get(expId)
      
      const expItem = {
        id: expId,
        user_id: null,
        trip_id: activeTripId,
        date,
        stage,
        category_id: tCatId,
        description: title.trim(),
        currency: isNational ? 'COP' : currency,
        amount_original: finalAmount,
        fx_rate_to_cop: finalFx,
        amount_cop: amountCop,
        created_at: existE ? existE.created_at : ts,
        updated_at: ts,
        deleted_at: null,
      }

      await db.gastos.put(expItem as AppExpense)
      await db.outbox.add({
        id: newId(),
        table_name: 'gastos',
        op: 'UPSERT',
        entity_id: expId,
        payload: expItem,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })
    })

    onClose()
  }

  async function onDelete() {
    if (!existingItem) return
    const ts = nowIso()
    const item: AppActivity = { ...existingItem, deleted_at: ts, updated_at: ts }
    await db.transaction('rw', [db.actividades, db.gastos, db.outbox], async () => {
      await db.actividades.put(item)
      await db.outbox.add({
        id: newId(),
        table_name: 'actividades',
        op: 'UPSERT',
        entity_id: existingItem.id,
        payload: item,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })

      const existingExp = await db.gastos.get(existingItem.id)
      if (existingExp && existingExp.deleted_at == null) {
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
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-safe sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (!showDeleteConfirm) onClose()
          }}
        >
          <motion.div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-zinc-900 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl custom-scrollbar"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                {existingItem ? 'Editar Actividad' : 'Nueva Actividad'}
              </h2>
              <button
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onClose()
                }}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                <div className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400">
                  {isNational ? 'Destino / Ciudad (*)' : 'País / Etapa (*)'}
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, stageOptions.length)}, minmax(0, 1fr))` }}
                >
                  {stageOptions.map((o) => {
                    const active = stage === o.stage
                    return (
                      <button
                        key={o.stage}
                        type="button"
                        className={
                          'flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-xs transition-colors ' +
                          (active
                            ? 'border-sky-500 bg-sky-500/10 text-zinc-50'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900')
                        }
                        onClick={() => {
                          setStage(o.stage)
                          const expected = stageToCurrency.get(o.stage) ?? 'COP'
                          if (!currencyTouchedRef.current) setCurrency(isNational ? 'COP' : expected)
                        }}
                      >
                        <FlagAvatar cca2={o.cca2} className="h-7 w-10" />
                        <div className="max-w-full truncate leading-none text-[11px]">{o.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Fecha (*)">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={tripStartYmd || undefined}
                    max={tripEndYmd || undefined}
                  />
                </Field>
                <Field label="Hora Inicio">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </Field>
                <Field label="Hora Fin">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Categoría de Actividad">
                <SheetSelect<ActivityType>
                  title="Categoría"
                  value={type}
                  options={types.map((t) => ({ value: t.val, label: t.label }))}
                  onChange={(v) => setType(v)}
                />
              </Field>

              <Field label="Título (*)">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-sky-300 placeholder-zinc-600 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  type="text"
                  placeholder="Ej: Tour por el Templo Kinkaku-ji"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Ciudad / Ubicación">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="text"
                    placeholder="Ej: Kyoto, Templo Norte"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Notas Adicionales">
                <textarea
                  className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="Instrucciones del guía, qué llevar..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>

              <div className="mt-2 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                <div className="text-sm font-semibold text-zinc-200">Costo (Opcional)</div>
                <div className="mt-1 text-xs text-zinc-400">Si fue gratis, deja 0.</div>

                <div className={`mt-3 grid ${isNational ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                  {!isNational ? (
                    <>
                      <Field label="Moneda">
                        <SheetSelect
                          title="Moneda"
                          value={currency}
                          options={currencyOptions.map((c) => ({ value: c, label: c }))}
                          onChange={(v) => setCurrencyTouched(v)}
                        />
                      </Field>
                      <Field label="Tasa a COP">
                        <input
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                          inputMode="decimal"
                          value={fxRate}
                          onChange={(e) => {
                            fxTouchedRef.current = true
                            setFxRate(e.target.value)
                          }}
                          placeholder="1"
                        />
                      </Field>
                    </>
                  ) : null}
                  <div className={isNational ? 'col-span-1' : 'col-span-2'}>
                    <Field label={isNational ? 'Monto (COP)' : 'Monto'}>
                      <input
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-emerald-400 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        inputMode="decimal"
                        placeholder="Ej: 50 ó 0"
                        value={amountOriginal}
                        onChange={(e) => setAmountOriginal(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              {showDeleteConfirm ? (
                <div className="flex w-full items-center justify-between rounded-2xl border border-rose-900/50 bg-rose-950/30 p-2 pl-4">
                  <span className="text-sm font-semibold text-rose-400">¿Eliminar actividad?</span>
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setShowDeleteConfirm(false)}
                      type="button"
                    >
                      No
                    </button>
                    <button
                      className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                      onClick={onDelete}
                      type="button"
                    >
                      Sí, eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {existingItem ? (
                    <button
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 active:scale-95"
                      onClick={() => setShowDeleteConfirm(true)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-100 transition-colors hover:bg-zinc-800 active:scale-95"
                      onClick={onClose}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={!title.trim()}
                      className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                      onClick={onSave}
                      type="button"
                    >
                      Guardar
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium tracking-wide text-zinc-400">{label}</div>
      {children}
    </label>
  )
}
