import type { AppCategory } from '@/../shared/types'
import { AnimatePresence, motion } from 'framer-motion'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExpenseFormState } from '@/types/expenses'
import { CATEGORY_KIND_LABEL } from '@/utils/categoryPalette'
import { stageForYmd, useTripStore } from '@/stores/tripStore'
import { formatFxRate, getRateToCop } from '@/fx/fx'
import AnimatedIcon from '@/components/AnimatedIcon'
import { Globe } from 'lucide-react'
import FlagAvatar from '@/components/FlagAvatar'
import SheetSelect from '@/components/SheetSelect'

export default function ExpenseModal({
  open,
  onClose,
  categories,
  form,
  setForm,
  amountCop,
  onSave,
  canSave,
  disabledReason,
  errorMessage,
  isEditing,
  onDelete,
  restrictedKinds,
  mirrorType,
  onOpenMirrorSource,
}: {
  open: boolean
  onClose: () => void
  categories: AppCategory[]
  form: ExpenseFormState
  setForm: Dispatch<SetStateAction<ExpenseFormState>>
  amountCop: number
  onSave: () => Promise<void>
  canSave: boolean
  disabledReason: string | null
  errorMessage: string | null
  isEditing?: boolean
  onDelete?: () => void
  restrictedKinds?: ExpenseFormState['categoryKind'][]
  mirrorType?: 'itinerario' | 'hospedaje' | 'actividad' | null
  onOpenMirrorSource?: () => void
}) {
  const countries = useTripStore((s) => s.countries)
  const segments = useTripStore((s) => s.segments)
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

  function setStageWithCurrency(stage: ExpenseFormState['stage']) {
    const expected = stageToCurrency.get(stage)
    setForm((f) => {
      const nextCurrency = currencyTouchedRef.current ? f.currency : (expected ?? f.currency)
      if (f.stage === stage && f.currency === nextCurrency) return f
      return { ...f, stage, currency: nextCurrency }
    })
  }

  function setCurrency(currency: ExpenseFormState['currency']) {
    currencyTouchedRef.current = true
    setForm((f) => (f.currency === currency ? f : { ...f, currency }))
  }

  async function prefillFxRate(currency: ExpenseFormState['currency'], ymd: string) {
    if (fxTouchedRef.current) return
    if (currency === 'COP') {
      setForm((f) => (f.fxRate === '1' ? f : { ...f, fxRate: '1' }))
      return
    }
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
    void prefillFxRate(form.currency, form.date)
  }, [open])

  const primaryByKind = useMemo(() => {
    const map = new Map<ExpenseFormState['categoryKind'], AppCategory | null>()
    const kinds = Object.keys(CATEGORY_KIND_LABEL) as ExpenseFormState['categoryKind'][]
    for (const kind of kinds) {
      map.set(kind, categories.find((c) => c.kind === kind && c.subkind == null && c.deleted_at == null) ?? null)
    }
    return map
  }, [categories])

  const isMirror = !!mirrorType
  const mirrorLabel =
    mirrorType === 'itinerario' ? 'ruta' : mirrorType === 'hospedaje' ? 'hospedaje' : mirrorType === 'actividad' ? 'actividad' : null

  const kindOptions = useMemo(() => {
    const all = Object.keys(CATEGORY_KIND_LABEL) as ExpenseFormState['categoryKind'][]
    const restricted = new Set((restrictedKinds ?? []).filter(Boolean))
    const base = all.filter((k) => !restricted.has(k))
    if (isEditing && restricted.has(form.categoryKind)) return [form.categoryKind, ...base.filter((k) => k !== form.categoryKind)]
    return base
  }, [form.categoryKind, isEditing, restrictedKinds])

  const subcategories = useMemo(() => {
    return categories
      .filter((c) => c.kind === form.categoryKind && c.subkind != null && c.deleted_at == null)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [categories, form.categoryKind])

  useEffect(() => {
    if (!open) return
    const primary = primaryByKind.get(form.categoryKind)
    if (subcategories.length === 0) {
      if (primary && form.categoryId !== primary.id) {
        setForm((f) => ({ ...f, categoryId: primary.id }))
      }
      return
    }

    const isValidSub = subcategories.some((c) => c.id === form.categoryId)
    if (!isValidSub) {
      setForm((f) => ({ ...f, categoryId: subcategories[0]!.id }))
    }
  }, [form.categoryKind, form.categoryId, open, primaryByKind, setForm, subcategories])

  const derivedStage = useMemo(() => {
    if (!form.date) return form.stage
    return stageForYmd(form.date, segments, form.stage)
  }, [form.date, form.stage, segments])

  const derivedSegment = useMemo(() => {
    if (!form.date) return null
    return segments.find((s) => s.startYmd <= form.date && form.date <= s.endYmd) ?? null
  }, [form.date, segments])

  useEffect(() => {
    if (!open) return
    if (!form.date) return
    if (form.stageMode !== 'AUTO') return
    if (derivedStage !== form.stage) setStageWithCurrency(derivedStage)
  }, [derivedStage, form.date, form.stage, form.stageMode, open])

  useEffect(() => {
    if (!open) return
    void prefillFxRate(form.currency, form.date)
  }, [form.currency, form.date, open])

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
              <div className="text-sm font-semibold">
                {isEditing ? (isMirror && mirrorLabel ? `Editar ${mirrorLabel} (gasto)` : 'Editar gasto') : 'Nuevo gasto'}
              </div>
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

            {isEditing && isMirror && mirrorLabel ? (
              <div className="mb-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-400">
                    Este es un gasto espejo. Edita el {mirrorLabel} desde su pantalla.
                  </div>
                  {onOpenMirrorSource ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                      onClick={onOpenMirrorSource}
                    >
                      Editar {mirrorLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mb-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-zinc-100">País</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      'rounded-xl px-3 py-1.5 text-xs font-semibold ' +
                      (form.stageMode === 'AUTO' ? 'bg-sky-500 text-slate-950' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800')
                    }
                    onClick={() => {
                      setForm((f) => ({ ...f, stageMode: 'AUTO' }))
                      setStageWithCurrency(derivedStage)
                    }}
                    disabled={isMirror}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={
                      'rounded-xl px-3 py-1.5 text-xs font-semibold ' +
                      (form.stageMode === 'MANUAL' ? 'bg-sky-500 text-slate-950' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800')
                    }
                    onClick={() => setForm((f) => ({ ...f, stageMode: 'MANUAL' }))}
                    disabled={isMirror}
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div
                className="mt-2 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, stageOptions.length)}, minmax(0, 1fr))` }}
              >
                {stageOptions.map((o) => {
                  const selectedStage = form.stageMode === 'AUTO' ? derivedStage : form.stage
                  const active = selectedStage === o.stage
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
                        setForm((f) => {
                          const expected = stageToCurrency.get(o.stage)
                          const nextCurrency = currencyTouchedRef.current ? f.currency : (expected ?? f.currency)
                          return { ...f, stageMode: 'MANUAL', stage: o.stage, currency: nextCurrency }
                        })
                        void prefillFxRate(o.currency, form.date)
                      }}
                      disabled={isMirror}
                    >
                      <FlagAvatar cca2={o.cca2} className="h-7 w-10" />
                      <div className="max-w-full truncate leading-none text-[11px]">{o.label}</div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-2 rounded-2xl border border-zinc-900 bg-zinc-950/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">
                  <FlagAvatar cca2={countries.find((c) => c.code === derivedSegment?.fromStage)?.acronym} className="h-4 w-6" imgClassName="h-full w-full" />
                  <span>{countries.find((c) => c.code === derivedSegment?.fromStage)?.name ?? (derivedSegment?.fromStage ?? '—')}</span>
                  <span className="text-zinc-600">→</span>
                  <FlagAvatar cca2={countries.find((c) => c.code === derivedSegment?.toStage)?.acronym} className="h-4 w-6" imgClassName="h-full w-full" />
                  <span>{countries.find((c) => c.code === derivedSegment?.toStage)?.name ?? (derivedSegment?.toStage ?? derivedStage)}</span>
                  <span>{form.stageMode === 'AUTO' ? ' · automático por fecha' : ' · tramo de referencia'}</span>
                </div>
              </div>
            </div>

            <div className={`grid ${isNational ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
              <Field label="Fecha">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  disabled={isMirror}
                  min={tripStartYmd || undefined}
                  max={tripEndYmd || undefined}
                />
              </Field>

              {!isNational && (
                <Field label="Moneda">
                  <SheetSelect
                    title="Moneda"
                    value={form.currency}
                    disabled={isMirror}
                    options={currencyOptions.map((c) => ({ value: c, label: c }))}
                    onChange={(v) => {
                      setCurrency(v as ExpenseFormState['currency'])
                      void prefillFxRate(v as ExpenseFormState['currency'], form.date)
                    }}
                  />
                </Field>
              )}
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Categoría">
                <SheetSelect
                  title="Categoría"
                  value={form.categoryKind}
                  disabled={isMirror}
                  options={kindOptions.map((k) => ({
                    value: k,
                    label: CATEGORY_KIND_LABEL[k],
                    disabled: (restrictedKinds ?? []).includes(k) && !(isEditing && form.categoryKind === k),
                  }))}
                  onChange={(v) => setForm((f) => ({ ...f, categoryKind: v as ExpenseFormState['categoryKind'], categoryId: '' }))}
                />
              </Field>

              <Field label={
                <div className="flex items-center gap-1.5">
                  <span>Subcategoría</span>
                  {form.categoryId && categories.find(c => c.id === form.categoryId)?.icon ? (
                    <AnimatedIcon name={categories.find(c => c.id === form.categoryId)!.icon!} className="w-3.5 h-3.5" color={categories.find(c => c.id === form.categoryId)?.color} />
                  ) : null}
                </div>
              }>
                <SheetSelect
                  title="Subcategoría"
                  value={form.categoryId}
                  disabled={isMirror || categories.length === 0 || (subcategories.length === 0 && !primaryByKind.get(form.categoryKind))}
                  options={
                    categories.length === 0
                      ? [{ value: '' as string, label: 'Cargando…', disabled: true }]
                      : subcategories.length === 0
                        ? primaryByKind.get(form.categoryKind)
                          ? [{ value: primaryByKind.get(form.categoryKind)!.id, label: CATEGORY_KIND_LABEL[form.categoryKind] }]
                          : [{ value: '' as string, label: 'Sin categorías', disabled: true }]
                        : subcategories.map((c) => ({ value: c.id, label: formatSubcategoryLabel(c.name) }))
                  }
                  onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                />
              </Field>

              <div className={isNational ? 'col-span-2' : ''}>
                <Field label={isNational ? 'Monto (COP)' : 'Monto'}>
                  <input
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    inputMode="decimal"
                    value={form.amountOriginal}
                    onChange={(e) => setForm((f) => ({ ...f, amountOriginal: e.target.value }))}
                    placeholder="0"
                  />
                </Field>
              </div>
              {!isNational && (
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
              )}
            </div>

            <div className="mt-3">
              <Field label="Descripción">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: ramen, metro, boleto…"
                  disabled={isMirror}
                />
              </Field>
            </div>

            <div className={`mt-4 flex items-center ${isNational ? 'justify-end' : 'justify-between'} gap-3`}>
              {!isNational && !showDeleteConfirm && <div className="text-xs text-zinc-400">Equivalente aprox: {formatCop(amountCop)}</div>}
              {showDeleteConfirm ? (
                <div className="flex w-full items-center justify-between rounded-2xl border border-rose-900/50 bg-rose-950/30 p-2 pl-4">
                  <span className="text-sm font-semibold text-rose-400">¿Eliminar gasto?</span>
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
              )}
            </div>

            {!canSave && disabledReason ? <div className="mt-2 text-xs text-zinc-400">{disabledReason}</div> : null}

            {errorMessage ? <div className="mt-3 rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-200">{errorMessage}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
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

function formatSubcategoryLabel(name: string) {
  const i = name.indexOf('—')
  if (i >= 0) return name.slice(i + 1).trim()
  return name
}
