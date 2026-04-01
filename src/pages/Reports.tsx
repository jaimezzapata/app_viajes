import Page from '@/components/Page'
import { db } from '@/db/appDb'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useOnline } from '@/hooks/useOnline'
import { syncNow } from '@/sync/sync'
import type { AppBudget, AppCategory, AppExpense, CategoryKind, CountryStage, UUID } from '@/../shared/types'
import { CATEGORY_KIND_COLOR, CATEGORY_KIND_LABEL } from '@/utils/categoryPalette'
import { nowIso, newId } from '@/utils/id'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTripStore } from '@/stores/tripStore'
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { exportConsolidatedExcel, exportExecutivePdf } from '@/utils/export'
import { AnimatePresence, motion } from 'framer-motion'

export default function Reports() {
  const online = useOnline()
  const countries = useTripStore((s) => s.countries)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async (format: 'pdf' | 'excel') => {
    if (!activeTripId) return
    setExporting(true)
    setDownloadOpen(false)
    try {
      const payload = { tripId: activeTripId, countries }
      if (format === 'excel') {
        await exportConsolidatedExcel(payload)
      } else {
        await exportExecutivePdf(payload)
      }
    } catch(err) {
      console.error(err)
      alert("Error al exportar reporte. Revisa la consola.")
    } finally {
      setExporting(false)
    }
  }, [activeTripId, countries])

  const { value: categories = [] } = useLiveQuery<AppCategory[]>(async () => await db.categorias.filter((c) => c.deleted_at == null).toArray(), [], [])
  const { value: expenses = [] } = useLiveQuery<AppExpense[]>(
    async () => {
      if (!activeTripId) return []
      return await db.gastos.where('trip_id').equals(activeTripId).filter((e) => e.deleted_at == null).toArray()
    },
    [activeTripId],
    [],
  )
  const { value: budgets = [] } = useLiveQuery<AppBudget[]>(
    async () => {
      if (!activeTripId) return []
      return await db.presupuestos.where('trip_id').equals(activeTripId).filter((b) => b.deleted_at == null && b.stage === 'GLOBAL' && b.category_id == null).toArray()
    },
    [activeTripId],
    [],
  )

  const categoryById = useMemo(() => new Map<UUID, AppCategory>(categories.map((c) => [c.id, c])), [categories])

  const spentTotal = useMemo(() => expenses.reduce((acc, e) => acc + (e.amount_cop ?? 0), 0), [expenses])

  const spentByStage = useMemo(() => {
    const map = new Map<CountryStage, number>()
    for (const e of expenses) {
      map.set(e.stage, (map.get(e.stage) ?? 0) + e.amount_cop)
    }
    return map
  }, [expenses])

  const spentByKind = useMemo(() => {
    const map: Record<CategoryKind, number> = {
      HOSPEDAJE: 0,
      TRANSPORTE: 0,
      COMIDA: 0,
      ENTRETENIMIENTO: 0,
      SOUVENIRES: 0,
      OTROS: 0,
    }
    for (const e of expenses) {
      const cat = categoryById.get(e.category_id)
      if (!cat) continue
      map[cat.kind] += e.amount_cop
    }
    return map
  }, [categoryById, expenses])

  const budgetTotal = useMemo(() => budgets.find((b) => b.category_id == null)?.amount_cop ?? 0, [budgets])

  const remainingTotal = useMemo(() => Math.max(0, budgetTotal - spentTotal), [budgetTotal, spentTotal])

  async function upsertGlobalBudget(amount_cop: number) {
    if (!activeTripId) return
    const ts = nowIso()
    const existing = budgets.find((b) => b.stage === 'GLOBAL' && b.category_id == null && b.deleted_at == null)
    const item: AppBudget = existing
      ? { ...existing, amount_cop, updated_at: ts }
      : {
          id: newId(),
          user_id: null,
          trip_id: activeTripId,
          stage: 'GLOBAL',
          category_id: null,
          amount_cop,
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        }

    await db.transaction('rw', db.presupuestos, db.outbox, async () => {
      await db.presupuestos.put(item)
      await db.outbox.add({
        id: newId(),
        table_name: 'presupuestos',
        op: 'UPSERT',
        entity_id: item.id,
        payload: item,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })
    })
  }

  const stageOptions = useMemo(
    () => countries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [countries],
  )

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Totales en COP</div>
          <div className="text-base font-semibold">Reportes</div>
        </div>
        <div className="flex items-center gap-2">
          {exporting && <span className="text-xs text-sky-400 font-medium animate-pulse">Procesando...</span>}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-2xl bg-sky-500 px-3 sm:px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95 disabled:opacity-50"
              onClick={() => setDownloadOpen((o) => !o)}
              disabled={!activeTripId || exporting}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {downloadOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40"
                    onClick={() => setDownloadOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl shadow-black/50"
                  >
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                      onClick={() => handleExport('pdf')}
                    >
                      <FileText className="h-4 w-4 text-rose-400" />
                      <div>
                        <div>Resumen Ejecutivo</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Documento PDF estático</div>
                      </div>
                    </button>
                    <button
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-emerald-400 transition-colors hover:bg-zinc-800"
                      onClick={() => handleExport('excel')}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <div>
                        <div>Consolidado Full</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Excel con Gastos e Itinerarios</div>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:opacity-50"
            onClick={() => void syncNow()}
            type="button"
            disabled={!online}
          >
            Sincronizar
          </button>
        </div>
      </div>

      <BudgetHero
        budgetTotal={budgetTotal}
        spentTotal={spentTotal}
        onSave={(amount) => void upsertGlobalBudget(amount)}
      />

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
          <div className="text-sm font-semibold">Resumen</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <KpiCard title="Gastado" value={formatCop(spentTotal)} hint={budgetTotal > 0 ? formatPct(spentTotal / budgetTotal) : null} color="#f43f5e" />
            <KpiCard title="Disponible" value={formatCop(remainingTotal)} hint={budgetTotal > 0 ? formatPct(remainingTotal / budgetTotal) : null} color="#22c55e" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
          <div className="text-sm font-semibold">Gasto por país</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {stageOptions.map((o) => (
              <MiniDonutCard
                key={o.stage}
                title={o.label}
                icon={o.flag}
                value={spentByStage.get(o.stage) ?? 0}
                total={spentTotal}
                color={stageColor(o.stage)}
                variant="stage"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
          <div className="text-sm font-semibold">Gasto por categoría</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(CATEGORY_KIND_LABEL) as CategoryKind[]).map((k) => (
              <MiniDonutCard
                key={k}
                title={CATEGORY_KIND_LABEL[k]}
                icon=""
                value={spentByKind[k]}
                total={spentTotal}
                color={CATEGORY_KIND_COLOR[k]}
                variant="category"
              />
            ))}
          </div>
        </div>
      </div>

    </Page>
  )
}

function stageColor(key: string) {
  const palette = ['#38bdf8', '#a78bfa', '#f59e0b', '#22c55e', '#f43f5e', '#fb7185', '#60a5fa', '#34d399']
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return palette[h % palette.length]!
}

function BudgetHero({
  budgetTotal,
  spentTotal,
  onSave,
}: {
  budgetTotal: number
  spentTotal: number
  onSave: (amountCop: number) => void
}) {
  const [value, setValue] = useState<string>(() => (budgetTotal ? String(budgetTotal) : ''))
  const prevBudget = useRef<number>(budgetTotal)

  useEffect(() => {
    const prev = prevBudget.current
    prevBudget.current = budgetTotal
    const prevText = prev ? String(prev) : ''
    if (value === prevText) {
      setValue(budgetTotal ? String(budgetTotal) : '')
    }
  }, [budgetTotal, value])

  const remaining = useMemo(() => Math.max(0, (budgetTotal ?? 0) - spentTotal), [budgetTotal, spentTotal])

  const parsed = useMemo(() => {
    const n = Number(value.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN
  }, [value])

  const canSave = Number.isFinite(parsed)

  const spentRatio = budgetTotal > 0 ? Math.min(1, spentTotal / budgetTotal) : 0
  const spentPctLabel = budgetTotal > 0 ? formatPct(spentRatio) : '0%'
  const donutSegments = useMemo(
    () => [
      { value: spentTotal, color: '#f43f5e' },
      { value: Math.max(0, budgetTotal - spentTotal), color: '#22c55e' },
    ],
    [budgetTotal, spentTotal],
  )

  return (
    <div className="rounded-3xl border border-zinc-900 bg-gradient-to-b from-zinc-950/70 to-zinc-950/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Presupuesto global</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-zinc-50">{formatCop(remaining)}</div>
          <div className="mt-2 text-sm text-zinc-300">restante</div>

          <div className="mt-3 text-xs text-zinc-400">Gastado: {formatCop(spentTotal)} · Total: {formatCop(budgetTotal)}</div>

          <div className="mt-4">
            <div className="text-[11px] text-zinc-400">Definir presupuesto (COP)</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ej: 5.000.000"
              />
              <button
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!canSave}
                onClick={() => {
                  if (!Number.isFinite(parsed)) return
                  onSave(parsed)
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <Donut
            size={132}
            thickness={14}
            segments={donutSegments}
            centerTop={spentPctLabel}
            centerBottom="gastado"
          />
          <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f43f5e', display: 'inline-block' }} />Gastado</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: '#22c55e', display: 'inline-block' }} />Disponible</span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-rose-500"
          style={{ width: `${budgetTotal > 0 ? Math.min(100, Math.max(0.5, (spentTotal / budgetTotal) * 100)) : 0}%` }}
        />
      </div>
    </div>
  )
}

function MiniDonutCard({
  title,
  icon,
  value,
  total,
  color,
  variant,
}: {
  title: string
  icon: string
  value: number
  total: number
  color: string
  variant: 'stage' | 'category'
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0
  const pctLabel = total > 0 ? formatPct(pct) : '0%'
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
      <div className="min-w-0">
        {variant === 'stage' ? (
          <div className="flex items-center gap-2">
            <div className="text-base leading-none shrink-0">{icon}</div>
            <div className="text-xs font-semibold text-zinc-100 truncate">{title}</div>
          </div>
        ) : (
          <div className="text-xs font-semibold text-zinc-100 truncate">{title}</div>
        )}
        <div className="mt-1 text-xs text-zinc-400 truncate">{formatCop(value)}</div>
      </div>
      <Donut
        size={46}
        thickness={8}
        segments={[{ value, color }, { value: Math.max(0, total - value), color: '#27272a' }]}
        centerTop={pctLabel}
      />
    </div>
  )
}

function KpiCard({ title, value, hint, color }: { title: string; value: string; hint: string | null; color: string }) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-zinc-100">{title}</div>
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: color, display: 'inline-block' }} />
          {hint ?? ''}
        </span>
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-50">{value}</div>
    </div>
  )
}

function Donut({
  size,
  thickness,
  segments,
  centerTop,
  centerBottom,
}: {
  size: number
  thickness: number
  segments: Array<{ value: number; color: string }>
  centerTop?: string
  centerBottom?: string
}) {
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0)

  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} stroke="#27272a" strokeWidth={thickness} fill="none" />
          {segments.map((s, idx) => {
            const v = Math.max(0, s.value)
            const frac = total > 0 ? v / total : 0
            const dash = circ * frac
            const dashArray = `${dash} ${circ - dash}`
            const dashOffset = -offset
            offset += dash
            return (
              <circle
                key={idx}
                cx={c}
                cy={c}
                r={r}
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </g>
      </svg>
      {(centerTop || centerBottom) ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerTop ? <div className="text-[11px] font-semibold text-zinc-100">{centerTop}</div> : null}
          {centerBottom ? <div className="text-[10px] text-zinc-400">{centerBottom}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

function formatPct(ratio: number) {
  const pct = ratio * 100
  if (pct > 0 && pct < 1) return '<1%'
  if (pct >= 100) return '100%'
  return `${Math.round(pct)}%`
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}
