import type { AppItinerary, AppExpense } from '@/../shared/types'
import { buildItineraryNotes, parseItineraryNotes, splitCsv } from '@/itinerary/notes'
import type { TripCountry } from '@/stores/tripStore'
import { useTripStore } from '@/stores/tripStore'
import { AnimatePresence, motion } from 'framer-motion'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState, useRef } from 'react'
import FlagAvatar from '@/components/FlagAvatar'
import SheetSelect from '@/components/SheetSelect'

export type ItineraryFormState = {
  date: string
  stage: string
  type: AppItinerary['type']
  title: string
  from_place: string
  to_place: string
  start_time: string
  end_time: string
  airlinesCsv: string
  stopsCsv: string
  note: string

  // Dual-Save Gasto
  currency: string
  amountOriginal: string
  fxRate: string
}

export default function ItineraryModal({
  open,
  onClose,
  countries,
  form,
  setForm,
  onSave,
  canSave,
  disabledReason,
  errorMessage,
  isEditing,
  onDelete,
  amountCop,
}: {
  open: boolean
  onClose: () => void
  countries: TripCountry[]
  form: ItineraryFormState
  setForm: Dispatch<SetStateAction<ItineraryFormState>>
  onSave: () => Promise<void>
  canSave: boolean
  disabledReason: string | null
  errorMessage: string | null
  isEditing?: boolean
  onDelete?: () => void
  amountCop: number
}) {
  const isNational = useTripStore((s) => s.isNational)
  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const fxTouchedRef = useRef(false)
  const currencyTouchedRef = useRef(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const stageOptions = useMemo(
    () =>
      countries.map((c) => ({
        stage: c.code,
        label: c.name,
        cca2: c.acronym,
        currency: c.currency,
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

  useEffect(() => {
    if (!open) return
    if (!form.stage && stageOptions.length > 0) {
      const expected = stageToCurrency.get(stageOptions[0]!.stage)
      setForm((f) => ({ ...f, stage: stageOptions[0]!.stage, currency: expected ?? f.currency }))
    }
  }, [form.stage, open, setForm, stageOptions, stageToCurrency])

  function setCurrency(currency: string) {
    currencyTouchedRef.current = true
    setForm((f) => (f.currency === currency ? f : { ...f, currency }))
  }

  async function prefillFxRate(currency: string, ymd: string) {
    if (fxTouchedRef.current) return
    if (currency === 'COP') {
      setForm((f) => (f.fxRate === '1' ? f : { ...f, fxRate: '1' }))
      return
    }
    if (!ymd) return
    try {
      const { getRateToCop, formatFxRate } = await import('@/fx/fx')
      const fx = await getRateToCop(currency, ymd)
      const txt = formatFxRate(fx.rate)
      if (!txt) return
      setForm((f) => {
        if (f.currency !== currency) return f
        if (fxTouchedRef.current) return f
        return { ...f, fxRate: txt }
      })
    } catch {
      return
    }
  }

  useEffect(() => {
    if (!open) return
    fxTouchedRef.current = false
    currencyTouchedRef.current = false
    void prefillFxRate(form.currency, form.date)
  }, [open])

  useEffect(() => {
    if (!open) return
    void prefillFxRate(form.currency, form.date)
  }, [form.currency, form.date, open])

// El useEffect original fue reemplazado arriba

  const isFlight = form.type === 'VUELO'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!showDeleteConfirm) onClose()
          }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="w-full max-w-md rounded-t-3xl border border-zinc-900 bg-zinc-950 p-4"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">{isEditing ? 'Editar trayecto' : 'Nuevo trayecto'}</div>
              <button 
                className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900" 
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onClose()
                }} 
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="País">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, stageOptions.length)}, minmax(0, 1fr))` }}
                  >
                    {stageOptions.map((o) => {
                      const active = form.stage === o.stage
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
                            const expected = stageToCurrency.get(o.stage)
                            const nextCurrency = currencyTouchedRef.current ? form.currency : (expected ?? form.currency)
                            setForm((f) => ({ ...f, stage: o.stage, currency: nextCurrency }))
                            void prefillFxRate(nextCurrency, form.date)
                          }}
                        >
                          <FlagAvatar cca2={o.cca2} className="h-7 w-10" />
                          <div className="max-w-full truncate leading-none text-[11px]">{o.label}</div>
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>

              <Field label="Fecha">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  min={tripStartYmd || undefined}
                  max={tripEndYmd || undefined}
                />
              </Field>

              <Field label="Tipo">
                <SheetSelect<AppItinerary['type']>
                  title="Tipo"
                  value={form.type}
                  options={[
                    { value: 'VUELO', label: 'Vuelo' },
                    { value: 'TREN', label: 'Tren' },
                    { value: 'BUS', label: 'Bus' },
                    { value: 'METRO', label: 'Metro' },
                    { value: 'A_PIE', label: 'A pie' },
                    { value: 'OTRO', label: 'Otro' },
                  ]}
                  onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                  buttonClassName="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                />
              </Field>

              <div className="col-span-2">
                <Field label="Título">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ej: Vuelo a Tokio"
                  />
                </Field>
              </div>

              <Field label="Desde">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  value={form.from_place}
                  onChange={(e) => setForm((f) => ({ ...f, from_place: e.target.value }))}
                  placeholder="Ej: Madrid"
                />
              </Field>
              <Field label="Hasta">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  value={form.to_place}
                  onChange={(e) => setForm((f) => ({ ...f, to_place: e.target.value }))}
                  placeholder="Ej: Tokio"
                />
              </Field>

              <Field label="Hora inicio">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </Field>
              <Field label="Hora fin">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </Field>
            </div>

            {isFlight ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Aerolínea(s)">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.airlinesCsv}
                    onChange={(e) => setForm((f) => ({ ...f, airlinesCsv: e.target.value }))}
                    placeholder="Ej: Iberia, LATAM"
                  />
                </Field>
                <Field label="Escala(s)">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.stopsCsv}
                    onChange={(e) => setForm((f) => ({ ...f, stopsCsv: e.target.value }))}
                    placeholder="Ej: París"
                  />
                </Field>
              </div>
            ) : null}

            <div className="mt-3">
              <Field label="Notas">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Ej: terminal, asiento, recordatorios…"
                />
              </Field>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
              <div className="text-xs font-semibold text-zinc-100 mb-2">Costo del boleto/trayecto (Opcional)</div>
              <div className={`grid ${isNational ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                {!isNational && (
                  <>
                    <Field label="Moneda">
                      <SheetSelect
                        title="Moneda"
                        value={form.currency}
                        options={currencyOptions.map((c) => ({ value: c, label: c }))}
                        onChange={(v) => {
                          setCurrency(v)
                          void prefillFxRate(v, form.date)
                        }}
                      />
                    </Field>
                    <Field label="Tasa a COP">
                      <input
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        inputMode="decimal"
                        value={form.fxRate}
                        onChange={(e) => {
                          fxTouchedRef.current = true
                          setForm((f) => ({ ...f, fxRate: e.target.value }))
                        }}
                        placeholder="1"
                      />
                    </Field>
                  </>
                )}
                <div className={isNational ? 'col-span-1' : 'col-span-2'}>
                  <Field label={isNational ? 'Monto total (COP)' : 'Monto total'}>
                    <input
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      inputMode="decimal"
                      value={form.amountOriginal}
                      onChange={(e) => setForm((f) => ({ ...f, amountOriginal: e.target.value }))}
                      placeholder="Ej: 50"
                    />
                  </Field>
                </div>
              </div>
              {form.amountOriginal.trim() !== '' && amountCop > 0 && !isNational ? (
                <div className="mt-2 text-[11px] text-zinc-400">
                  Total en base: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amountCop)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {showDeleteConfirm ? (
                <div className="flex w-full items-center justify-between rounded-2xl border border-rose-900/50 bg-rose-950/30 p-2 pl-4">
                  <span className="text-sm font-semibold text-rose-400">¿Eliminar trayecto?</span>
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
                  <div className="text-[11px] text-zinc-400 leading-tight max-w-[150px]">
                    {!canSave && disabledReason ? disabledReason : (
                      form.amountOriginal ? 'Se guardará también como gasto.' : 'Solo se guardará el trayecto.'
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isEditing && onDelete ? (
                      <button
                        className="rounded-2xl border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-900/50 active:scale-95"
                        onClick={() => setShowDeleteConfirm(true)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    ) : null}
                    <button
                      className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void onSave()}
                      disabled={!canSave}
                      type="button"
                    >
                      {isEditing ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {errorMessage ? <div className="mt-3 rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-200">{errorMessage}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function toFormState(todayYmd: string, countries: TripCountry[], existing?: AppItinerary, existingExpense?: AppExpense): ItineraryFormState {
  if (!existing) {
    const stage = countries[0]?.code ?? 'COLOMBIA'
    const currency = countries[0]?.currency ?? 'COP'
    return {
      date: todayYmd,
      stage,
      type: 'VUELO',
      title: '',
      from_place: '',
      to_place: '',
      start_time: '',
      end_time: '',
      airlinesCsv: '',
      stopsCsv: '',
      note: '',
      currency,
      amountOriginal: '',
      fxRate: '1',
    }
  }

  const parsed = parseItineraryNotes(existing.notes)
  return {
    date: existing.date,
    stage: existing.stage,
    type: existing.type,
    title: existing.title,
    from_place: existing.from_place ?? '',
    to_place: existing.to_place ?? '',
    start_time: existing.start_time ?? '',
    end_time: existing.end_time ?? '',
    airlinesCsv: (parsed.airlines ?? []).join(', '),
    stopsCsv: (parsed.stops ?? []).join(', '),
    note: parsed.note ?? '',
    currency: existingExpense ? existingExpense.currency : (countries.find(c => c.code === existing.stage)?.currency ?? 'COP'),
    amountOriginal: existingExpense ? existingExpense.amount_original.toString().replace('.', ',') : '',
    fxRate: existingExpense ? existingExpense.fx_rate_to_cop.toString().replace('.', ',') : '1',
  }
}

export function toItineraryNotes(form: ItineraryFormState) {
  return buildItineraryNotes({
    airlines: splitCsv(form.airlinesCsv),
    stops: splitCsv(form.stopsCsv),
    note: form.note,
  })
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-300">{label}</div>
      {children}
    </label>
  )
}
