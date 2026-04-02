import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useOnline } from '@/hooks/useOnline'
import { syncNow } from '@/sync/sync'
import { supabase } from '@/supabase/client'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { LogOut } from 'lucide-react'
import { useTripStore } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { addDays, toYmd } from '@/utils/date'
import TripConfigModal from '@/components/TripConfigModal'

export default function AppShell({ children }: PropsWithChildren) {
  const online = useOnline()
  const [syncing, setSyncing] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const segments = useTripStore((s) => s.segments)
  const countries = useTripStore((s) => s.countries)
  const activeTripId = useTripStore((s) => s.activeTripId)

  const { value: outboxCount } = useLiveQuery<number>(async () => await db.outbox.count(), [], 0)
  const { value: categoryCount } = useLiveQuery<number>(async () => await db.categorias.count(), [], 0)
  const { value: lastSyncAt } = useLiveQuery<string | null>(async () => (await db.sync_state.get('last_sync_success_at'))?.value ?? null, [], null)
  const { value: lastSyncError } = useLiveQuery<string>(async () => (await db.sync_state.get('last_sync_error'))?.value ?? '', [], '')

  useEffect(() => {
    if (online) void syncNow()
  }, [online])

  async function onSync() {
    if (!online) return
    setSyncing(true)
    try {
      await syncNow()
    } finally {
      setSyncing(false)
    }
  }

  async function onResetLocal() {
    const ok = window.confirm('Esto borrará TODOS los datos locales (gastos, categorías, presupuestos, etc.). ¿Deseas continuar?')
    if (!ok) return
    try {
      await db.delete()
    } finally {
      window.location.reload()
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold tracking-tight text-white drop-shadow-md">App Viajes</div>
                <TripSelector onConfigure={(isNew) => { setIsCreatingNew(!!isNew); setConfigOpen(true) }} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className={`block h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {online ? 'Online' : 'Offline'}
                </span>
                <span>·</span>
                {outboxCount > 0 ? (
                  <span className="text-amber-400">{outboxCount} pend.</span>
                ) : (
                  <span>Sincronizado</span>
                )}
                {lastSyncAt ? (
                  <>
                    <span>·</span>
                    <span>{new Date(lastSyncAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : null}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                className="flex items-center justify-center rounded-xl bg-orange-500/10 px-3 py-1.5 text-[11px] font-semibold text-orange-400 transition-colors hover:bg-orange-500/20"
                type="button"
                onClick={() => void onResetLocal()}
                title="Limpiar memoria local"
              >
                Limpiar datos
              </button>
              <button
                className="flex items-center justify-center rounded-xl bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                type="button"
                onClick={() => void onSync()}
                disabled={!online || syncing}
              >
                {syncing ? 'Syncing...' : 'Sincronizar'}
              </button>
              <button
                className="flex items-center justify-center rounded-xl bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                type="button"
                onClick={handleSignOut}
                title="Cerrar sesión"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Salir
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-2.5">
            <TripSummary activeTripId={activeTripId} tripStartYmd={tripStartYmd} tripEndYmd={tripEndYmd} segments={segments} countries={countries} onConfigure={() => { setIsCreatingNew(false); setConfigOpen(true) }} />
          </div>

          {lastSyncError ? <div className="mt-2 rounded-xl border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-[10px] text-rose-200">Error: {lastSyncError}</div> : null}
        </header>
      </div>
      {children}
      <BottomNav />
      <TripConfigModal open={configOpen} onClose={() => { setConfigOpen(false); setIsCreatingNew(false) }} isNew={isCreatingNew} />
    </div>
  )
}

function TripSelector({ onConfigure }: { onConfigure: (isNew?: boolean) => void }) {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const setActiveTripId = useTripStore((s) => s.setActiveTripId)
  const { value: trips = [] } = useLiveQuery(
    async () => await db.viajes.filter(t => t.deleted_at == null).toArray(), 
    [], 
    []
  )

  function handleNewTrip() {
    onConfigure(true)
  }

  // Always render the select so users can see the "Nuevo viaje" option even if DB drops
  return (
    <div className="flex items-center gap-1 ml-1">
      <select
        value={activeTripId ?? ''}
        onChange={(e) => {
          if (e.target.value === 'NEW') void handleNewTrip()
          else setActiveTripId(e.target.value)
        }}
        className="max-w-[140px] truncate rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-sky-400 outline-none hover:bg-zinc-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
      >
        {trips.length === 0 ? <option value="">(Sin viajes)</option> : null}
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        <option value="NEW" className="text-emerald-400 font-bold">
          + Nuevo viaje
        </option>
      </select>
    </div>
  )
}

function TripSummary({
  activeTripId,
  tripStartYmd,
  tripEndYmd,
  segments,
  countries,
  onConfigure,
}: {
  activeTripId: string | null
  tripStartYmd: string
  tripEndYmd: string
  segments: Array<{ fromStage: string; toStage: string; startYmd: string; endYmd: string }>
  countries: Array<{ code: string; acronym: string; flag: string }>
  onConfigure: () => void
}) {
  const byCode = new Map(countries.map((c) => [c.code, c]))
  const tripOk = !!tripStartYmd && !!tripEndYmd && tripStartYmd <= tripEndYmd
  const segCount = segments.length
  const routes = segments
    .slice()
    .sort((a, b) => a.startYmd.localeCompare(b.startYmd))
    .slice(0, 2)
    .map((s) => `${byCode.get(s.fromStage)?.acronym ?? s.fromStage}→${byCode.get(s.toStage)?.acronym ?? s.toStage}`)
    .join(' · ')

  if (!activeTripId || !tripOk) {
    if (!activeTripId) return <div className="mt-0.5 text-[11px] text-zinc-500 font-medium">Ningún viaje seleccionado</div>
    return <div className="mt-0.5 text-[11px] text-rose-300">Viaje: sin fechas</div>
  }

  return (
    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
      <div>
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="font-medium text-zinc-200">{tripStartYmd}</span>
          <span className="text-zinc-600">→</span>
          <span className="font-medium text-zinc-200">{tripEndYmd}</span>
        </div>
        <div className="mt-1 text-zinc-400">
          {segCount > 0 ? `${segCount} tramos` : 'Sin tramos'}
          {routes ? ` · ${routes}${segCount > 2 ? '…' : ''}` : ''}
        </div>
      </div>
      <button 
        type="button" 
        onClick={onConfigure}
        className="ml-2 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[10px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
      >
        Configurar
      </button>
    </div>
  )
}
