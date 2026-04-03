import type { AppLodging, AppExpense } from '@/../shared/types'
import type { TripCountry } from '@/stores/tripStore'
import { useTripStore } from '@/stores/tripStore'
import { AnimatePresence, motion } from 'framer-motion'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatFxRate, getRateToCop } from '@/fx/fx'
import FlagAvatar from '@/components/FlagAvatar'
import SheetSelect from '@/components/SheetSelect'

export type LodgingFormState = {
  stage: string
  name: string
  city: string
  check_in: string
  check_out: string
  address: string
  note: string

  // Dual-Save Gasto
  currency: string
  amountOriginal: string
  fxRate: string
}

export default function LodgingModal({
  open,
  onClose,
  countries,
  form,
  setForm,
  amountCop,
  onSave,
  canSave,
  disabledReason,
  errorMessage,
  isEditing,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  countries: TripCountry[]
  form: LodgingFormState
  setForm: Dispatch<SetStateAction<LodgingFormState>>
  amountCop: number
  onSave: () => Promise<void>
  canSave: boolean
  disabledReason: string | null
  errorMessage: string | null
  isEditing?: boolean
  onDelete?: () => void
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
    // We use check_in as the reference date for FX
    if (!ymd) return
    try {
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
    void prefillFxRate(form.currency, form.check_in)
  }, [open])

  useEffect(() => {
    if (!open) return
    void prefillFxRate(form.currency, form.check_in)
  }, [form.currency, form.check_in, open])

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
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-zinc-900 bg-zinc-950 p-4 custom-scrollbar"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">{isEditing ? 'Editar hospedaje' : 'Nuevo hospedaje'}</div>
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

            <div className="mb-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
              <div className="text-xs font-semibold text-zinc-100 mb-2">{isNational ? 'Destino/Ciudad' : 'País'}</div>
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
                        void prefillFxRate(nextCurrency, form.check_in)
                      }}
                    >
                      <FlagAvatar cca2={o.cca2} className="h-7 w-10" />
                      <div className="max-w-full truncate leading-none text-[11px]">{o.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Nombre del lugar">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Airbnb Tokio, Hotel ibis…"
                  />
                </Field>
              </div>

              <Field label="Check-in">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  type="date"
                  value={form.check_in}
                  onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))}
                  min={tripStartYmd || undefined}
                  max={(form.check_out || tripEndYmd) || undefined}
                />
              </Field>
              <Field label="Check-out">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  type="date"
                  value={form.check_out}
                  onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))}
                  min={(form.check_in || tripStartYmd) || undefined}
                  max={tripEndYmd || undefined}
                />
              </Field>

              <Field label="Ciudad">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Ej: Kioto"
                />
              </Field>
              <Field label="Dirección / Zona">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Ej: Gion, 123-456"
                />
              </Field>

              <div className="col-span-2">
                <Field label="Notas">
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Ej: Puerta 3, PIN 1234…"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
              <div className="text-xs font-semibold text-zinc-100 mb-2">Costo del hospedaje (Opcional)</div>
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
                          void prefillFxRate(v, form.check_in)
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
                  Total en base: {formatCop(amountCop)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {showDeleteConfirm ? (
                <div className="flex w-full items-center justify-between rounded-2xl border border-rose-900/50 bg-rose-950/30 p-2 pl-4">
                  <span className="text-sm font-semibold text-rose-400">¿Eliminar hospedaje?</span>
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
                      form.amountOriginal ? 'Se guardará también como gasto.' : 'Solo se guardará la reserva.'
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
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

export function toLodgingFormState(todayYmd: string, countries: TripCountry[], existingLodging?: AppLodging, existingExpense?: AppExpense): LodgingFormState {
  if (!existingLodging) {
    const stage = countries[0]?.code ?? 'COLOMBIA'
    const currency = countries[0]?.currency ?? 'COP'
    return {
      stage,
      name: '',
      city: '',
      check_in: todayYmd,
      check_out: '',
      address: '',
      note: '',
      currency,
      amountOriginal: '',
      fxRate: '1',
    }
  }

  return {
    stage: existingLodging.stage,
    name: existingLodging.name,
    city: existingLodging.city,
    check_in: existingLodging.check_in,
    check_out: existingLodging.check_out,
    address: existingLodging.address,
    note: existingLodging.notes,
    currency: existingExpense ? existingExpense.currency : (countries.find(c => c.code === existingLodging.stage)?.currency ?? 'COP'),
    amountOriginal: existingExpense ? existingExpense.amount_original.toString().replace('.', ',') : '',
    fxRate: existingExpense ? existingExpense.fx_rate_to_cop.toString().replace('.', ',') : '1',
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-300">{label}</div>
      {children}
    </label>
  )
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}
