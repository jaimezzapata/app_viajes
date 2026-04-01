import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, useMemo } from 'react'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { parseYmd, toYmd } from '@/utils/date'
import type { AppActivity, ActivityType, AppExpense } from '@/../shared/types'

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

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [stage, setStage] = useState('')
  const [type, setType] = useState<ActivityType>('TOUR')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [bookingRefs, setBookingRefs] = useState('')
  const [notes, setNotes] = useState('')

  // Dual-save / Mirror Expense
  const [createExpense, setCreateExpense] = useState(true)
  const [expenseAmountStr, setExpenseAmountStr] = useState('')

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
      setBookingRefs(existingItem.booking_refs || '')
      setNotes(existingItem.notes)
      
      setCreateExpense(true)
      setExpenseAmountStr('')
      
      // Fetch existing connected expense
      db.gastos.get(existingItem.id).then(exp => {
        if (exp) {
          setExpenseAmountStr(exp.amount_original.toString())
        } else {
          setExpenseAmountStr('0')
        }
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
      setBookingRefs('')
      setNotes('')
      
      setCreateExpense(true)
      setExpenseAmountStr('')
    }
  }, [open, existingItem, selectedYmd, tripStartYmd, segments, countries])

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
      booking_refs: bookingRefs.trim() || null,
      notes: notes.trim(),
      created_at: existingItem?.created_at || ts,
      updated_at: ts,
      deleted_at: null,
    }

    // All activities MUST have a mirror expense now.
    const val = parseFloat(expenseAmountStr.replace(/[^0-9.-]/g, ''))
    const finalVal = isNaN(val) || val < 0 ? 0 : val

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
      let tCat = categories.find((c) => c.kind === 'ENTRETENIMIENTO' && (c.subkind === 'GENERAL' || c.deleted_at == null))
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

      const countryObj = countries.find((c) => c.code === stage)
      const myCurrency = countryObj?.currency || 'COP'
      
      const fxMeta = await db.meta.get(`fx_${myCurrency}`)
      let tRate = 1
      if (fxMeta) {
        try {
          const parsed = JSON.parse(fxMeta.value)
          tRate = Number(parsed.cop_per_unit || 1)
        } catch { }
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
        currency: myCurrency,
        amount_original: finalVal,
        fx_rate_to_cop: tRate,
        amount_cop: finalVal * tRate,
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
          onClick={onClose}
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
                onClick={onClose}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha (*)">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field label="País / Etapa (*)">
                  <select
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {types.map((t) => {
                    const active = type === t.val
                    return (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setType(t.val)}
                        className={`overflow-hidden rounded-xl border px-2 py-2 text-left text-xs font-semibold transition-all ${
                          active
                            ? `border-${t.bg.split('-')[1]}-500/50 ${t.bg} ${t.text} ring-1 ring-${t.bg.split('-')[1]}-500/50`
                            : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
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
                <Field label="Ticket / #Reserva (Opcional)">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    type="text"
                    placeholder="Ej: Código QR-482..."
                    value={bookingRefs}
                    onChange={(e) => setBookingRefs(e.target.value)}
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

              <div className="mt-2 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-200">Gasto Registrado Obligatorio</div>
                  <div className="text-xs text-zinc-400">Si la actividad fue gratis, ingresa 0.</div>
                </div>
                
                <div className="mt-3">
                  <Field label={`Valor en ${countries.find(c => c.code === stage)?.currency || '?'} (*)`}>
                    <input
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-emerald-400 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                      type="number"
                      placeholder="Ej: 50.00 ó 0"
                      value={expenseAmountStr}
                      onChange={(e) => setExpenseAmountStr(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              {existingItem ? (
                <button
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 active:scale-95"
                  onClick={onDelete}
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
                  disabled={!title.trim() || !expenseAmountStr}
                  className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                  onClick={onSave}
                  type="button"
                >
                  Guardar
                </button>
              </div>
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
