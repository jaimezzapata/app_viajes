import { motion } from 'framer-motion'
import { PlusCircle, Map, Calendar as CalendarIcon, Globe } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import { useDynamicHead } from '@/hooks/useDynamicHead'

export default function Home() {
  useDynamicHead('Inicio', 'Home')
  const navigate = useNavigate()
  const setActiveTripId = useTripStore((s) => s.setActiveTripId)
  const { value: trips = [] } = useLiveQuery(
    async () => await db.viajes.filter(t => t.deleted_at == null).toArray(),
    [],
    []
  )

  const { nationalTrips, internationalTrips } = useMemo(() => {
    const nationalTrips = trips.filter((t) => !!t.is_national)
    const internationalTrips = trips.filter((t) => !t.is_national)
    return { nationalTrips, internationalTrips }
  }, [trips])

  function openCreateTrip() {
    document.dispatchEvent(new Event('open-create-trip'))
  }

  function handleSelectTrip(id: string) {
    setActiveTripId(id)
    navigate('/calendario')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-5 pb-24"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">Mis Viajes</h1>
        <p className="text-xs text-zinc-400 mt-1 font-medium">Selecciona un viaje para ver su itinerario y gastos</p>
      </div>

      <div className="grid gap-3">
        {trips.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/50">
            <Globe className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-400 font-medium">Aún no has configurado ningún viaje.</p>
          </div>
        ) : null}

        {nationalTrips.length > 0 ? (
          <div className="mt-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">Nacionales</div>
            <div className="grid gap-3">
              {nationalTrips.map(trip => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => handleSelectTrip(trip.id)}
                  className="group text-left relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-emerald-500/30 hover:bg-zinc-900/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-lg font-bold text-zinc-100">{trip.name || 'Sin nombre'}</div>
                    <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-colors">
                      <Map className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-400 mt-4">
                    <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50">
                      <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{trip.start_date.substring(5)} a {trip.end_date.substring(5)}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-950/30 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-900/50">
                      Nacional
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {internationalTrips.length > 0 ? (
          <div className="mt-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300/80">Internacionales</div>
            <div className="grid gap-3">
              {internationalTrips.map(trip => {
                let countriesCount = 0
                try {
                  const parsed = JSON.parse(trip.countries_json)
                  countriesCount = Array.isArray(parsed) ? parsed.length : 0
                } catch {}

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => handleSelectTrip(trip.id)}
                    className="group text-left relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-sky-500/30 hover:bg-zinc-900/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-lg font-bold text-zinc-100">{trip.name || 'Sin nombre'}</div>
                      <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-sky-400 group-hover:bg-sky-500/10 group-hover:border-sky-500/30 transition-colors">
                        <Map className="w-4 h-4" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-400 mt-4">
                      <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50">
                        <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{trip.start_date.substring(5)} a {trip.end_date.substring(5)}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-sky-950/30 text-sky-400 px-2 py-1 rounded-lg border border-sky-900/50">
                        {countriesCount} {countriesCount === 1 ? 'país' : 'países'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <button
          onClick={openCreateTrip}
          className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-sky-500/30 bg-sky-500/5 p-6 transition-all hover:border-sky-400/60 hover:bg-sky-500/10 active:scale-[0.98]"
        >
          <PlusCircle className="h-8 w-8 text-sky-500" />
          <span className="text-sm font-bold text-sky-400">Crear Viaje Nuevo</span>
        </button>
      </div>
    </motion.div>
  )
}
