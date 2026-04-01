import { useState } from 'react'
import { Plus, Ticket, Camera, Utensils, ShoppingBag, MapPin, Map as MapIcon, HelpCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import Page from '@/components/Page'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { useTripStore, type TripCountry } from '@/stores/tripStore'
import { formatDayLabel } from '@/utils/date'
import type { AppActivity, ActivityType } from '@/../shared/types'
import ActivityModal from '@/components/ActivityModal'
import CategoryPill from '@/components/CategoryPill'
import { useOnline } from '@/hooks/useOnline'
import { WifiOff } from 'lucide-react'

export default function Activities() {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const countries = useTripStore((s) => s.countries)
  const online = useOnline()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AppActivity | null>(null)
  const [openByStage, setOpenByStage] = useState<Record<string, boolean>>({})

  const { value: allActivities = [] } = useLiveQuery<AppActivity[]>(
    async () => {
      if (!activeTripId) return []
      return await db.actividades.where('trip_id').equals(activeTripId).filter((a) => !a.deleted_at).toArray()
    },
    [activeTripId],
    [],
  )

  const stageOptions = useMemo(
    () => countries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [countries],
  )

  const activitiesByStage = useMemo(() => {
    const map = new Map<string, AppActivity[]>()
    for (const a of allActivities) {
      const arr = map.get(a.stage) ?? []
      arr.push(a)
      map.set(a.stage, arr)
    }
    // Sort items inside each stage by date and then time
    for (const [, items] of map.entries()) {
      items.sort((a, b) => {
        const d = a.date.localeCompare(b.date)
        if (d !== 0) return d
        return (a.start_time || '').localeCompare(b.start_time || '')
      })
    }
    return map
  }, [allActivities])

  const orderedStages = useMemo(() => {
    const configured = stageOptions.map((s) => s.stage)
    const present = Array.from(activitiesByStage.keys())
    const extra = present.filter((k) => !configured.includes(k)).sort((a, b) => a.localeCompare(b, 'es'))
    return [...configured, ...extra]
  }, [activitiesByStage, stageOptions])

  if (!activeTripId) {
    return (
      <Page>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-zinc-500" />
          <h2 className="text-lg font-semibold text-zinc-200">Primero configura el viaje</h2>
          <p className="mt-2 max-w-[260px] text-sm text-zinc-500">Crea o selecciona un viaje en la pantalla principal para poder agregar actividades.</p>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">Agenda de eventos</div>
          <div className="text-base font-semibold">Actividades</div>
        </div>
        <div className="flex items-center gap-2">
          {!online ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-400">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          ) : null}
          <button
            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            onClick={() => {
              setEditingItem(null)
              setModalOpen(true)
            }}
            type="button"
          >
            Nuevo
          </button>
        </div>
      </div>

      <div className="space-y-4 pb-24">
        {orderedStages.map((stageKey) => {
          const items = activitiesByStage.get(stageKey) ?? []
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
                    <div className="text-[11px] text-zinc-400">{items.length} actividades</div>
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
                    {items.map((item) => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        onClick={() => {
                          setEditingItem(item)
                          setModalOpen(true)
                        }}
                        countries={countries}
                      />
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}

        {allActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/20 p-8 text-center text-sm text-zinc-400">
            Sin actividades registradas todavía.
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <ActivityModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          existingItem={editingItem}
        />
      ) : null}
    </Page>
  )
}

function ActivityCard({ item, onClick, countries }: { item: AppActivity; onClick: () => void; countries: TripCountry[] }) {
  const c = countries.find((x) => x.code === item.stage)
  const isTimeComplete = item.start_time && item.end_time

  return (
    <button
      type="button"
      className="w-full text-left rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3 hover:bg-zinc-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/30"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <CategoryPill label={item.type} color={getTypeColor(item.type)} icon={<TypeIcon type={item.type} className="h-3 w-3" />} />
            <span className="text-[11px] text-zinc-400 font-medium bg-zinc-800/40 px-2 py-0.5 rounded-xl border border-zinc-800">
              {item.date}
            </span>
            {item.start_time ? (
              <span className="text-[11px] text-zinc-400">
                {item.start_time} {isTimeComplete ? `- ${item.end_time}` : ''}
              </span>
            ) : null}
          </div>
          
          <div className="text-sm font-semibold text-zinc-100 line-clamp-2">{item.title}</div>
          
          {item.location ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
              <span className="line-clamp-1">{item.location}</span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function getTypeColor(type: ActivityType) {
  switch (type) {
    case 'MUSEO':
      return '#8b5cf6' // violet
    case 'RESTAURANTE':
      return '#f97316' // orange
    case 'TOUR':
      return '#0ea5e9' // sky
    case 'EVENTO':
      return '#f43f5e' // rose
    case 'COMPRAS':
      return '#10b981' // emerald
    case 'OTRO':
    default:
      return '#64748b' // slate
  }
}

function TypeIcon({ type, className }: { type: ActivityType; className?: string }) {
  switch (type) {
    case 'MUSEO':
      return <MapIcon className={className} />
    case 'RESTAURANTE':
      return <Utensils className={className} />
    case 'TOUR':
      return <Camera className={className} />
    case 'EVENTO':
      return <Ticket className={className} />
    case 'COMPRAS':
      return <ShoppingBag className={className} />
    case 'OTRO':
    default:
      return <HelpCircle className={className} />
  }
}
