import Page from '@/components/Page'
import { useTripStore } from '@/stores/tripStore'
import { addDays, formatDayLabel, parseYmd, toYmd } from '@/utils/date'
import { useMemo, type ReactNode } from 'react'
import { db } from '@/db/appDb'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import CategoryPill from '@/components/CategoryPill'
import { ChevronDown, ChevronUp, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnline } from '@/hooks/useOnline'

type DaySummary = {
  ymd: string
  totalCop: number
  items: Array<{ id: string; label: string; cop: number; color: string }>
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

      const result: DaySummary[] = []
      for (const ymd of days) {
        const expenses = await db.gastos
          .where('trip_id')
          .equals(activeTripId)
          .filter((e) => e.date === ymd && !e.deleted_at)
          .toArray()

        const items = expenses
          .slice(0, 6)
          .map((e) => {
            const cat = byId.get(e.category_id)
            return {
              id: e.id,
              label: cat?.name ?? e.description,
              cop: e.amount_cop,
              color: cat?.color ?? '#94a3b8',
            }
          })
        const totalCop = expenses.reduce((acc, e) => acc + e.amount_cop, 0)
        
        const itineraries = await db.itinerarios
          .where('trip_id')
          .equals(activeTripId)
          .filter((i) => i.date === ymd && !i.deleted_at)
          .toArray()
        
        itineraries.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

        const routes = itineraries.map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          from: i.from_place,
          to: i.to_place,
          time: i.start_time,
        }))

        const allLodgings = await db.hospedajes
          .where('trip_id')
          .equals(activeTripId)
          .filter((l) => !l.deleted_at)
          .toArray()
        const activeLodgings = allLodgings.filter((l) => ymd >= l.check_in && ymd < l.check_out)
        const lodgings = activeLodgings.map((l) => ({ id: l.id, name: l.name, city: l.city }))

        const allActivities = await db.actividades
          .where('trip_id')
          .equals(activeTripId)
          .filter((a) => !a.deleted_at && a.date === ymd)
          .toArray()
        allActivities.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        
        const activities = allActivities.map((a) => ({ id: a.id, type: a.type, title: a.title, time: a.start_time }))

        result.push({ ymd, totalCop, items, routes, lodgings, activities })
      }
      return result
    },
    [days.join('|'), activeTripId],
    [],
  )

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
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={onToggle}
        type="button"
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-zinc-100">{formatDayLabel(summary.ymd)}</div>
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
            <div className="mt-2 grid grid-cols-1 gap-3">
              <Section title="Actividades" empty="Sin actividades (MVP)">
                <div className="grid grid-cols-1 gap-2">
                  {summary.activities.length === 0 ? <div className="text-xs text-zinc-400">Sin actividades programadas.</div> : null}
                  {summary.activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 shadow-sm">
                      <div className="mt-0.5 shrink-0">
                        <CategoryPill label={act.type} color="#d946ef" />
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
                        <CategoryPill label={rt.type} color="#0ea5e9" />
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
                        <CategoryPill label="HOTEL" color="#f43f5e" />
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
                      <CategoryPill label={it.label} color={it.color} />
                      <div className="text-xs text-zinc-200">{formatCop(it.cop)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
