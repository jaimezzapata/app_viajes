import { motion } from 'framer-motion'
import { PlusCircle, Map as MapIcon, Calendar as CalendarIcon, Globe, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import { useDynamicHead } from '@/hooks/useDynamicHead'
import FlagAvatar from '@/components/FlagAvatar'
import { parseYmd } from '@/utils/date'
import type { AppExpense } from '@/../shared/types'
import { supabase } from '@/supabase/client'

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

  const tripAccentColor = useMemo(() => {
    const palette = ['#38bdf8', '#a78bfa', '#f59e0b', '#22c55e', '#f43f5e', '#fb7185', '#60a5fa', '#34d399']
    const hash = (s: string) => {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
      return h
    }
    return (id: string) => palette[hash(id) % palette.length]!
  }, [])

  const parseTripCountries = useMemo(() => {
    return (countriesJson: string) => {
      try {
        const parsed = JSON.parse(countriesJson)
        return Array.isArray(parsed) ? (parsed as Array<{ acronym?: string; code?: string }>) : []
      } catch {
        return []
      }
    }
  }, [])

  const tripIds = useMemo(() => trips.map((t) => t.id), [trips])
  const tripIdsKey = useMemo(() => tripIds.slice().sort().join(','), [tripIds])

  const { value: spentByTrip = new Map<string, number>() } = useLiveQuery<Map<string, number>>(
    async () => {
      if (tripIds.length === 0) return new Map()
      const rows: AppExpense[] = await db.gastos.where('trip_id').anyOf(tripIds).filter((e) => e.deleted_at == null).toArray()
      const map = new Map<string, number>()
      for (const e of rows) {
        map.set(e.trip_id, (map.get(e.trip_id) ?? 0) + (e.amount_cop ?? 0))
      }
      return map
    },
    [tripIdsKey],
    new Map(),
  )

  const tripDuration = useMemo(() => {
    const diffDays = (a: string, b: string) => {
      const da = parseYmd(a).getTime()
      const dbb = parseYmd(b).getTime()
      return Math.round((dbb - da) / 86400000)
    }
    return (start: string, end: string) => {
      if (!start || !end) return { days: 0, nights: 0 }
      const d = diffDays(start, end)
      const days = Math.max(1, d + 1)
      const nights = Math.max(0, days - 1)
      return { days, nights }
    }
  }, [])

  function openCreateTrip() {
    document.dispatchEvent(new Event('open-create-trip'))
  }

  function handleSelectTrip(id: string) {
    setActiveTripId(id)
    navigate('/calendario')
  }

  async function shareTrip(tripId: string) {
    if (!supabase) {
      alert('Supabase no está configurado. No se puede generar el link.')
      return
    }
    try {
      const { data, error } = await supabase.rpc('create_trip_share', { p_trip_id: tripId })
      if (error) throw error
      const url = `${window.location.origin}/compartir/${data}`
      try {
        await navigator.clipboard.writeText(url)
        alert('Link copiado al portapapeles.')
      } catch {
        alert(url)
      }
    } catch (e) {
      console.error(e)
      alert('Error generando link para compartir.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-5 pb-24"
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">Mis Viajes</h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Selecciona un viaje para ver su itinerario y gastos</p>
        </div>
        <button
          onClick={openCreateTrip}
          type="button"
          className="shrink-0 flex items-center gap-2 rounded-2xl border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-2 transition-all hover:border-sky-400/60 hover:bg-sky-500/10 active:scale-[0.98]"
        >
          <PlusCircle className="h-5 w-5 text-sky-500" />
          <span className="text-xs font-bold text-sky-400">Crear</span>
        </button>
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
              {nationalTrips.map(trip => {
                const accent = tripAccentColor(trip.id)
                const tripCountries = parseTripCountries(trip.countries_json)
                const flags = tripCountries.map((c) => String(c.acronym ?? '')).filter((x) => x.length === 2)
                const { days, nights } = tripDuration(trip.start_date, trip.end_date)
                const spent = spentByTrip.get(trip.id) ?? 0

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => handleSelectTrip(trip.id)}
                    className="group text-left relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-emerald-500/30 hover:bg-zinc-900/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: accent }} />
                    <div className="flex justify-between items-start mb-2 pl-1">
                      <div className="text-lg font-bold text-zinc-100">{trip.name || 'Sin nombre'}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            void shareTrip(trip.id)
                          }}
                          title="Compartir"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-colors">
                          <MapIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {flags.length > 0 ? (
                      <div className="mt-3 flex items-center gap-1.5 pl-1">
                        {flags.slice(0, 6).map((cca2) => (
                          <FlagAvatar key={`${trip.id}-${cca2}`} cca2={cca2} className="h-5 w-7" />
                        ))}
                        {flags.length > 6 ? <div className="text-[10px] font-semibold text-zinc-500">+{flags.length - 6}</div> : null}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-400 mt-4 pl-1">
                      <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50">
                        <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{trip.start_date} a {trip.end_date}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50 text-zinc-300">
                        {days} {days === 1 ? 'día' : 'días'} · {nights} {nights === 1 ? 'noche' : 'noches'}
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50 text-zinc-200">
                        {formatCop(spent)}
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-950/30 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-900/50">
                        Nacional
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {internationalTrips.length > 0 ? (
          <div className="mt-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300/80">Internacionales</div>
            <div className="grid gap-3">
              {internationalTrips.map(trip => {
                const accent = tripAccentColor(trip.id)
                const tripCountries = parseTripCountries(trip.countries_json)
                const flags = tripCountries.map((c) => String(c.acronym ?? '')).filter((x) => x.length === 2)
                const countriesCount = tripCountries.length
                const { days, nights } = tripDuration(trip.start_date, trip.end_date)
                const spent = spentByTrip.get(trip.id) ?? 0

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => handleSelectTrip(trip.id)}
                    className="group text-left relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-sky-500/30 hover:bg-zinc-900/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: accent }} />
                    <div className="flex justify-between items-start mb-2 pl-1">
                      <div className="text-lg font-bold text-zinc-100">{trip.name || 'Sin nombre'}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            void shareTrip(trip.id)
                          }}
                          title="Compartir"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 text-sky-400 group-hover:bg-sky-500/10 group-hover:border-sky-500/30 transition-colors">
                          <MapIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {flags.length > 0 ? (
                      <div className="mt-3 flex items-center gap-1.5 pl-1">
                        {flags.slice(0, 6).map((cca2) => (
                          <FlagAvatar key={`${trip.id}-${cca2}`} cca2={cca2} className="h-5 w-7" />
                        ))}
                        {flags.length > 6 ? <div className="text-[10px] font-semibold text-zinc-500">+{flags.length - 6}</div> : null}
                      </div>
                    ) : null}
                    
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-400 mt-4 pl-1">
                      <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50">
                        <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{trip.start_date} a {trip.end_date}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50 text-zinc-300">
                        {days} {days === 1 ? 'día' : 'días'} · {nights} {nights === 1 ? 'noche' : 'noches'}
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/50 text-zinc-200">
                        {formatCop(spent)}
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
      </div>
    </motion.div>
  )
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
