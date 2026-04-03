import Page from '@/components/Page'
import FlagAvatar from '@/components/FlagAvatar'
import CategoryPill from '@/components/CategoryPill'
import { supabase } from '@/supabase/client'
import { addDays, parseYmd, toYmd } from '@/utils/date'
import { useDynamicHead } from '@/hooks/useDynamicHead'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AppActivity, AppBudget, AppCategory, AppExpense, AppItinerary, AppLodging, AppTrip } from '@/../shared/types'

type SharedTripPayload = {
  trip: AppTrip | null
  categorias: AppCategory[]
  gastos: AppExpense[]
  itinerarios: AppItinerary[]
  hospedajes: AppLodging[]
  actividades: AppActivity[]
  presupuestos: AppBudget[]
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

export default function SharedTrip() {
  useDynamicHead('Viaje compartido', 'Share2')
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SharedTripPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) return
      if (!supabase) {
        setData(null)
        setError('Supabase no está configurado en esta app.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token })
        if (error) throw error
        if (cancelled) return
        if (!data) {
          setData(null)
          setError('Este link no existe o fue revocado.')
          return
        }
        setData(data as SharedTripPayload)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Error cargando viaje compartido.'
        setError(msg)
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  const trip = data?.trip ?? null
  const countries = useMemo(() => {
    if (!trip?.countries_json) return []
    try {
      const parsed = JSON.parse(trip.countries_json)
      return Array.isArray(parsed) ? (parsed as Array<{ acronym?: string; name?: string }>) : []
    } catch {
      return []
    }
  }, [trip?.countries_json])

  const dayList = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return []
    const start = parseYmd(trip.start_date)
    const end = parseYmd(trip.end_date)
    const days: string[] = []
    let cur = start
    while (cur.getTime() <= end.getTime()) {
      days.push(toYmd(cur))
      cur = addDays(cur, 1)
    }
    return days
  }, [trip?.end_date, trip?.start_date])

  const categoryById = useMemo(() => new Map((data?.categorias ?? []).map((c) => [c.id, c] as const)), [data?.categorias])

  const expensesByDay = useMemo(() => {
    const map = new Map<string, AppExpense[]>()
    for (const e of data?.gastos ?? []) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    for (const [k, v] of map.entries()) v.sort((a, b) => (b.amount_cop ?? 0) - (a.amount_cop ?? 0))
    return map
  }, [data?.gastos])

  const itinerariesByDay = useMemo(() => {
    const map = new Map<string, AppItinerary[]>()
    for (const i of data?.itinerarios ?? []) {
      if (!map.has(i.date)) map.set(i.date, [])
      map.get(i.date)!.push(i)
    }
    for (const [k, v] of map.entries()) v.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    return map
  }, [data?.itinerarios])

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, AppActivity[]>()
    for (const a of data?.actividades ?? []) {
      if (!map.has(a.date)) map.set(a.date, [])
      map.get(a.date)!.push(a)
    }
    for (const [k, v] of map.entries()) v.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    return map
  }, [data?.actividades])

  const lodgingsForDay = useMemo(() => {
    const lodgings = data?.hospedajes ?? []
    return (ymd: string) => lodgings.filter((l) => l.check_in <= ymd && ymd < l.check_out)
  }, [data?.hospedajes])

  const totalCop = useMemo(() => (data?.gastos ?? []).reduce((acc, e) => acc + (e.amount_cop ?? 0), 0), [data?.gastos])

  return (
    <Page>
      <div className="mb-4">
        <div className="text-xs text-zinc-400">Viaje compartido</div>
        <div className="text-base font-semibold">{trip?.name ?? 'Viaje'}</div>
        {trip?.start_date && trip?.end_date ? <div className="mt-1 text-xs text-zinc-500">{trip.start_date} a {trip.end_date}</div> : null}
        {countries.length > 0 ? (
          <div className="mt-2 flex items-center gap-1.5">
            {countries
              .map((c) => String(c.acronym ?? '').trim().toUpperCase())
              .filter((x) => x.length === 2)
              .slice(0, 8)
              .map((cca2) => (
                <FlagAvatar key={cca2} cca2={cca2} className="h-5 w-7" />
              ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-400">Cargando…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div>
      ) : !data || !trip ? (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-400">No hay datos para mostrar.</div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
            <div className="text-sm font-semibold">Total gastado</div>
            <div className="mt-1 text-xl font-black">{formatCop(totalCop)}</div>
          </div>

          <div className="space-y-3">
            {dayList.map((ymd) => {
              const its = itinerariesByDay.get(ymd) ?? []
              const acts = activitiesByDay.get(ymd) ?? []
              const exps = expensesByDay.get(ymd) ?? []
              const lods = lodgingsForDay(ymd)
              const dayTotal = exps.reduce((acc, e) => acc + (e.amount_cop ?? 0), 0)

              if (its.length === 0 && acts.length === 0 && exps.length === 0 && lods.length === 0) return null

              return (
                <div key={ymd} className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{ymd}</div>
                    {dayTotal > 0 ? <div className="text-xs font-semibold text-zinc-300">{formatCop(dayTotal)}</div> : null}
                  </div>

                  {lods.length > 0 ? (
                    <div className="mt-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Hotel</div>
                      <div className="space-y-2">
                        {lods.map((l) => (
                          <div key={l.id} className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-3">
                            <div className="text-xs font-semibold text-zinc-200">{l.name}</div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">{l.city} · {l.check_in} → {l.check_out}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {its.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Rutas</div>
                      <div className="space-y-2">
                        {its.map((i) => (
                          <div key={i.id} className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-zinc-200 truncate">{i.title}</div>
                              <div className="text-[11px] text-zinc-500">{i.start_time ?? ''}{i.end_time ? `–${i.end_time}` : ''}</div>
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">{i.from_place ?? ''}{i.to_place ? ` → ${i.to_place}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {acts.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Actividades</div>
                      <div className="space-y-2">
                        {acts.map((a) => (
                          <div key={a.id} className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-zinc-200 truncate">{a.title}</div>
                              <div className="text-[11px] text-zinc-500">{a.start_time ?? ''}{a.end_time ? `–${a.end_time}` : ''}</div>
                            </div>
                            {a.location ? <div className="mt-0.5 text-[11px] text-zinc-500">{a.location}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {exps.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Gastos</div>
                      <div className="flex flex-wrap gap-2">
                        {exps.slice(0, 10).map((e) => {
                          const cat = categoryById.get(e.category_id)
                          return (
                            <div key={e.id} className="rounded-xl border border-zinc-900 bg-zinc-950/50 px-2 py-2">
                              <CategoryPill label={cat?.name ?? 'Gasto'} color={cat?.color ?? '#3b82f6'} iconName={cat?.icon ?? 'Receipt'} />
                              <div className="mt-1 text-[11px] font-semibold text-zinc-200">{formatCop(e.amount_cop ?? 0)}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Page>
  )
}
