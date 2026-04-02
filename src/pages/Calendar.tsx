import Page from '@/components/Page'
import { useTripStore } from '@/stores/tripStore'
import { addDays, formatDayLabel, parseYmd, toYmd } from '@/utils/date'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '@/db/appDb'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import CategoryPill from '@/components/CategoryPill'
import AnimatedIcon from '@/components/AnimatedIcon'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnline } from '@/hooks/useOnline'

type DaySummary = {
  ymd: string
  totalCop: number
  items: Array<{ id: string; label: string; cop: number; color: string; iconName?: string | null }>
  routes: Array<{ id: string; type: string; title: string; from: string | null; to: string | null; time: string | null }>
  lodgings: Array<{ id: string; name: string; city: string }>
  activities: Array<{ id: string; type: string; title: string; time: string | null }>
}

export default function Calendar() {
  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const selectedYmd = useTripStore((s) => s.selectedYmd)
  const setSelectedYmd = useTripStore((s) => s.setSelectedYmd)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const online = useOnline()
  const [view, setView] = useState<'MES' | 'AGENDA'>('MES')
  const todayYmd = useMemo(() => toYmd(new Date()), [])
  const todayInTrip = !!tripStartYmd && !!tripEndYmd && tripStartYmd <= todayYmd && todayYmd <= tripEndYmd

  const days = useMemo(() => {
    if (!tripStartYmd || !tripEndYmd) return []
    const start = parseYmd(tripStartYmd)
    const end = parseYmd(tripEndYmd)
    
    const timeDiff = end.getTime() - start.getTime()
    const diffDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)))
    const count = diffDays + 1
    const length = Math.min(count, 365) // Cap at 1 year max for safety
    
    return Array.from({ length }, (_, i) => toYmd(addDays(start, i)))
  }, [tripStartYmd, tripEndYmd])

  const { value: summaries = [] } = useLiveQuery<DaySummary[]>(
    async () => {
      if (!activeTripId) return []
      const categories = await db.categorias.toArray()
      const byId = new Map(categories.map((c) => [c.id, c]))

      const allExpenses = await db.gastos.where('trip_id').equals(activeTripId).filter(e => !e.deleted_at).toArray()
      const allItineraries = await db.itinerarios.where('trip_id').equals(activeTripId).filter(i => !i.deleted_at).toArray()
      const allLodgings = await db.hospedajes.where('trip_id').equals(activeTripId).filter(l => !l.deleted_at).toArray()
      const allActivities = await db.actividades.where('trip_id').equals(activeTripId).filter(a => !a.deleted_at).toArray()

      const result: DaySummary[] = []
      for (const ymd of days) {
        const expenses = allExpenses.filter(e => e.date === ymd)

        const agg = new Map<string, { id: string; label: string; cop: number; color: string; iconName?: string | null }>()
        for (const e of expenses) {
          const cat = byId.get(e.category_id)
          const key = e.category_id || e.id
          const prev = agg.get(key)
          const next = {
            id: key,
            label: cat?.name ?? e.description,
            cop: (prev?.cop ?? 0) + e.amount_cop,
            color: cat?.color ?? '#94a3b8',
            iconName: cat?.icon ?? null,
          }
          agg.set(key, next)
        }

        const items = Array.from(agg.values())
          .sort((a, b) => b.cop - a.cop)
          .slice(0, 6)
        const totalCop = expenses.reduce((acc, e) => acc + e.amount_cop, 0)
        
        const dayItis = allItineraries.filter(i => i.date === ymd).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        const routes = dayItis.map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          from: i.from_place,
          to: i.to_place,
          time: i.start_time,
        }))

        const activeLodgings = allLodgings.filter((l) => ymd >= l.check_in && ymd < l.check_out)
        const lodgings = activeLodgings.map((l) => ({ id: l.id, name: l.name, city: l.city }))

        const dayActs = allActivities.filter(a => a.date === ymd).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        const activities = dayActs.map((a) => ({ id: a.id, type: a.type, title: a.title, time: a.start_time }))

        result.push({ ymd, totalCop, items, routes, lodgings, activities })
      }
      return result
    },
    [days.join('|'), activeTripId],
    [],
  )

  const monthKeys = useMemo(() => {
    const set = new Set<string>()
    for (const d of days) set.add(d.slice(0, 7))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [days])

  const initialMonthKey = useMemo(() => {
    if (selectedYmd) return selectedYmd.slice(0, 7)
    if (tripStartYmd) return tripStartYmd.slice(0, 7)
    return toYmd(new Date()).slice(0, 7)
  }, [selectedYmd, tripStartYmd])

  const [monthKey, setMonthKey] = useState(initialMonthKey)

  useEffect(() => {
    if (!selectedYmd) return
    const mk = selectedYmd.slice(0, 7)
    if (mk !== monthKey) setMonthKey(mk)
  }, [monthKey, selectedYmd])

  const summariesByYmd = useMemo(() => new Map(summaries.map((s) => [s.ymd, s] as const)), [summaries])

  const monthTitle = useMemo(() => {
    const dt = parseYmd(`${monthKey}-01`)
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(dt)
  }, [monthKey])

  const monthGrid = useMemo(() => {
    const first = parseYmd(`${monthKey}-01`)
    const dow = first.getDay()
    const mondayBasedOffset = (dow + 6) % 7
    const start = addDays(first, -mondayBasedOffset)
    return Array.from({ length: 42 }, (_, i) => {
      const ymd = toYmd(addDays(start, i))
      return {
        ymd,
        inMonth: ymd.slice(0, 7) === monthKey,
        summary: summariesByYmd.get(ymd),
      }
    })
  }, [monthKey, summariesByYmd])

  const canPrevMonth = useMemo(() => {
    if (monthKeys.length === 0) return false
    return monthKeys.indexOf(monthKey) > 0
  }, [monthKey, monthKeys])

  const canNextMonth = useMemo(() => {
    if (monthKeys.length === 0) return false
    return monthKeys.indexOf(monthKey) >= 0 && monthKeys.indexOf(monthKey) < monthKeys.length - 1
  }, [monthKey, monthKeys])

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Viaje {days.length} días</div>
          <div className="text-base font-semibold">Calendario</div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1 text-xs text-zinc-300">
          {!online ? <WifiOff className="h-4 w-4" /> : null}
          <span>{online ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-2xl border border-zinc-900 bg-zinc-950/40 p-1">
          <button
            type="button"
            onClick={() => setView('MES')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${view === 'MES' ? 'bg-sky-500/10 text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Mes
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('AGENDA')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${view === 'AGENDA' ? 'bg-sky-500/10 text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Agenda
          </button>
        </div>

        {view === 'MES' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-900 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
              disabled={!canPrevMonth}
              onClick={() => {
                const idx = monthKeys.indexOf(monthKey)
                if (idx > 0) setMonthKey(monthKeys[idx - 1]!)
              }}
              title="Mes anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 max-w-[160px] rounded-xl border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 capitalize truncate">
              {monthTitle}
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-900 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
              disabled={!canNextMonth}
              onClick={() => {
                const idx = monthKeys.indexOf(monthKey)
                if (idx >= 0 && idx < monthKeys.length - 1) setMonthKey(monthKeys[idx + 1]!)
              }}
              title="Mes siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>

      {view === 'MES' ? (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-1.5">
          <div className="mb-2 grid grid-cols-7 gap-1 text-[8px] font-semibold uppercase tracking-wide text-zinc-600">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, idx) => (
              <div key={idx} className="text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell) => {
              const s = cell.summary
              const dayNum = Number(cell.ymd.slice(8, 10))
              const isSelected = cell.ymd === selectedYmd
              const isActive = !!s

              const uniqueIcons = s ? Array.from(new Set(s.items.map((it) => it.iconName).filter(Boolean) as string[])) : []
              const iconNames = uniqueIcons.slice(0, 3)
              const extraIconCount = Math.max(0, uniqueIcons.length - iconNames.length)

              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => {
                    if (!isActive) return
                    setSelectedYmd(cell.ymd)
                  }}
                  className={[
                    'h-[92px] rounded-xl border px-2 py-2 text-left transition-colors flex flex-col shadow-sm shadow-black/20 overflow-hidden',
                    cell.inMonth ? 'bg-zinc-950/55' : 'bg-zinc-950/20',
                    isActive ? 'border-zinc-800/60 hover:bg-zinc-900/35 hover:border-zinc-700/70' : 'border-zinc-900/40 opacity-30 cursor-default',
                    isSelected ? 'ring-2 ring-sky-500/20 border-sky-500/35 bg-sky-500/5' : '',
                    todayInTrip && cell.ymd === todayYmd ? 'border-amber-500/35 bg-amber-500/5' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`text-[11px] font-bold tabular-nums ${isSelected ? 'text-sky-300' : cell.inMonth ? 'text-zinc-200' : 'text-zinc-600'}`}>
                        {dayNum}
                      </div>
                      {todayInTrip && cell.ymd === todayYmd ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" /> : null}
                    </div>
                    <span />
                  </div>

                  {s && s.totalCop > 0 ? (
                    <div className="mt-1 rounded-md border border-emerald-500/12 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold tabular-nums text-emerald-300 text-center">
                      {formatShortCop(s.totalCop)}
                    </div>
                  ) : (
                    <div className="mt-1 h-[16px]" />
                  )}

                  <div className="mt-2 flex items-center gap-1">
                    {iconNames.slice(0, 2).map((name) => (
                      <span key={name} className="flex h-5 w-5 items-center justify-center rounded-md border border-zinc-800/60 bg-zinc-950/40 text-zinc-200">
                        <AnimatedIcon name={name} className="w-3 h-3" />
                      </span>
                    ))}
                    {extraIconCount > 0 ? (
                      <span className="text-[9px] font-semibold text-zinc-500">+{extraIconCount}</span>
                    ) : null}
                  </div>

                  {s ? (
                    <div className="mt-auto flex items-center gap-1 pt-2 text-[9px] text-zinc-500">
                      {s.activities.length > 0 ? <span className="h-1 w-1 rounded-full bg-fuchsia-500/70" /> : null}
                      {s.routes.length > 0 ? <span className="h-1 w-1 rounded-full bg-sky-500/70" /> : null}
                      {s.lodgings.length > 0 ? <span className="h-1 w-1 rounded-full bg-rose-500/70" /> : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <DayCard
              key={s.ymd}
              summary={s}
              open={s.ymd === selectedYmd}
              onToggle={() => setSelectedYmd(s.ymd === selectedYmd ? '' : s.ymd)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {view === 'MES' && selectedYmd ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedYmd('')}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="w-full max-w-md rounded-t-3xl border border-zinc-900 bg-zinc-950 p-4 max-h-[80dvh] overflow-y-auto"
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {summariesByYmd.get(selectedYmd) ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{formatDayLabel(selectedYmd)}</div>
                      <div className="text-xs text-zinc-400">Total COP {formatCop(summariesByYmd.get(selectedYmd)!.totalCop)}</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setSelectedYmd('')}
                    >
                      Cerrar
                    </button>
                  </div>
                  <DayDetails summary={summariesByYmd.get(selectedYmd)!} />
                </>
              ) : (
                <div className="text-sm text-zinc-400">No hay información para este día.</div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Page>
  )
}

function DayCard({
  summary,
  open,
  onToggle,
}: {
  summary: DaySummary
  open: boolean
  onToggle: () => void
}) {
  const todayYmd = useMemo(() => toYmd(new Date()), [])
  const isToday = summary.ymd === todayYmd

  return (
    <div className={`rounded-2xl border bg-zinc-950/40 ${isToday ? 'border-amber-500/35 shadow-sm shadow-amber-500/10' : 'border-zinc-900'}`}>
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={onToggle}
        type="button"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-zinc-100">{formatDayLabel(summary.ymd)}</div>
            {isToday ? (
              <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                HOY
              </span>
            ) : null}
          </div>
          <div className="text-xs text-zinc-400">Total COP {formatCop(summary.totalCop)}</div>
        </div>
        <div className="text-zinc-300">{open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="px-4 pb-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <DayDetails summary={summary} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function DayDetails({ summary }: { summary: DaySummary }) {
  const activityIconName = (t: string) => {
    const map: Record<string, string> = {
      MUSEO: 'Camera',
      RESTAURANTE: 'Utensils',
      TOUR: 'MapPin',
      EVENTO: 'Ticket',
      COMPRAS: 'ShoppingBag',
      OTRO: 'HelpCircle',
    }
    return map[t] ?? 'HelpCircle'
  }

  const routeIconName = (t: string) => {
    const map: Record<string, string> = {
      VUELO: 'Plane',
      TREN: 'Train',
      BUS: 'Bus',
      METRO: 'TramFront',
      A_PIE: 'Footprints',
      OTRO: 'Map',
    }
    return map[t] ?? 'Map'
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-3">
      <Section title="Actividades" empty="Sin actividades (MVP)">
        <div className="grid grid-cols-1 gap-2">
          {summary.activities.length === 0 ? <div className="text-xs text-zinc-400">Sin actividades programadas.</div> : null}
          {summary.activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 shadow-sm">
              <div className="mt-0.5 shrink-0">
                <CategoryPill label={act.type} color="#d946ef" iconName={activityIconName(act.type)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-zinc-200 truncate">{act.title}</div>
                  {act.time ? <div className="text-[11px] text-zinc-400 shrink-0">{act.time}</div> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Rutas" empty="Sin rutas registradas">
        <div className="grid grid-cols-1 gap-2">
          {summary.routes.length === 0 ? <div className="text-xs text-zinc-400">Sin rutas para este día.</div> : null}
          {summary.routes.map((rt) => (
            <div key={rt.id} className="flex items-start gap-3 rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 shadow-sm">
              <div className="mt-0.5 shrink-0">
                <CategoryPill label={rt.type} color="#0ea5e9" iconName={routeIconName(rt.type)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-zinc-200 truncate">{rt.title}</div>
                  {rt.time ? <div className="text-[11px] text-zinc-400 shrink-0">{rt.time}</div> : null}
                </div>
                {rt.from || rt.to ? (
                  <div className="mt-1 text-[11px] text-zinc-400 truncate">
                    {rt.from ? <span className="text-zinc-300">{rt.from}</span> : '—'}
                    {' → '}
                    {rt.to ? <span className="text-zinc-300">{rt.to}</span> : '—'}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Hotel" empty="Sin hospedaje">
        <div className="grid grid-cols-1 gap-2">
          {summary.lodgings.length === 0 ? <div className="text-xs text-zinc-400">La noche sin hotel asignado.</div> : null}
          {summary.lodgings.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 shadow-sm">
              <div className="shrink-0">
                <CategoryPill label="HOTEL" color="#f43f5e" iconName="Hotel" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-200 truncate">{l.name}</div>
                {l.city ? <div className="text-[11px] text-zinc-400 truncate">{l.city}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Gastos" empty="Sin gastos">
        <div className="flex flex-wrap gap-2">
          {summary.items.length === 0 ? <div className="text-xs text-zinc-400">Sin gastos registrados.</div> : null}
          {summary.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950/60 px-3 py-2">
              <CategoryPill label={it.label} color={it.color} iconName={it.iconName} />
              <div className="text-xs text-zinc-200">{formatCop(it.cop)}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">{title}</div>
      <div className="text-sm">{children ?? <div className="text-xs text-zinc-400">{empty}</div>}</div>
    </div>
  )
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatShortCop(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const str = m.toFixed(1).replace('.', ',')
    return `${value < 0 ? '-' : ''}$${str}M`
  }
  if (abs >= 100_000) {
    const k = Math.round(abs / 1_000)
    return `${value < 0 ? '-' : ''}$${k}k`
  }
  const formatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abs)
  return `${value < 0 ? '-' : ''}${formatted.replace(/\s/g, '').replace('COP', '$')}`
}
