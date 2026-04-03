import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from '@/components/BottomNav'
import { useOnline } from '@/hooks/useOnline'
import { syncNow } from '@/sync/sync'
import { supabase } from '@/supabase/client'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { LogOut, Trash2, RefreshCw, Home as HomeIcon, Check } from 'lucide-react'
import { useTripStore } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { addDays, toYmd } from '@/utils/date'
import TripConfigModal from '@/components/TripConfigModal'
import SheetSelect from '@/components/SheetSelect'

export default function AppShell({ children }: PropsWithChildren) {
  const online = useOnline()
  const location = useLocation()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)

  const tripStartYmd = useTripStore((s) => s.tripStartYmd)
  const tripEndYmd = useTripStore((s) => s.tripEndYmd)
  const segments = useTripStore((s) => s.segments)
  const countries = useTripStore((s) => s.countries)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const setActiveTripId = useTripStore((s) => s.setActiveTripId)

  const { value: outboxCount } = useLiveQuery<number>(async () => await db.outbox.count(), [], 0)
  const { value: categoryCount } = useLiveQuery<number>(async () => await db.categorias.count(), [], 0)
  const { value: lastSyncAt } = useLiveQuery<string | null>(async () => (await db.sync_state.get('last_sync_success_at'))?.value ?? null, [], null)
  const { value: lastSyncError } = useLiveQuery<string>(async () => (await db.sync_state.get('last_sync_error'))?.value ?? '', [], '')

  useEffect(() => {
    if (online) void syncNow()
  }, [online])

  // Sync automático en segundo plano cuando se detectan tareas pendientes en el outbox
  useEffect(() => {
    if (online && outboxCount > 0 && !syncing) {
      const timer = setTimeout(() => {
        void onSync()
      }, 1500) // Se espera 1.5s para agrupar operaciones rápidas y evitar saturar la base de datos
      return () => clearTimeout(timer)
    }
  }, [online, outboxCount, syncing])

  useEffect(() => {
    const handler = () => { setIsCreatingNew(true); setConfigOpen(true); }
    document.addEventListener('open-create-trip', handler)
    return () => document.removeEventListener('open-create-trip', handler)
  }, [])

  const isHome = location.pathname === '/inicio'

  useEffect(() => {
    if (!isHome && !activeTripId) {
      navigate('/inicio', { replace: true })
    }
  }, [isHome, activeTripId, navigate])

  async function onSync() {
    if (!online) return
    setSyncing(true)
    try {
      await syncNow()
    } finally {
      setSyncing(false)
    }
  }

  async function performResetLocal() {
    try {
      await db.delete()
      localStorage.clear()
    } finally {
      window.location.href = '/inicio'
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className={`min-h-dvh bg-zinc-950 text-zinc-100 ${!isHome ? 'pb-20' : ''}`}>
      <div className="mx-auto w-full max-w-md">
        <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!isHome ? (
                  <button 
                    onClick={() => { setActiveTripId(null); navigate('/inicio') }}
                    className="flex w-7 h-7 items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors mr-1"
                  >
                    <HomeIcon className="w-4 h-4 text-zinc-400" />
                  </button>
                ) : null}
                <div className="text-base font-black tracking-tight text-white drop-shadow-md cursor-pointer" onClick={() => navigate('/inicio')}>App Viajes</div>
                {!isHome ? <TripSelector onConfigure={(isNew) => { setIsCreatingNew(!!isNew); setConfigOpen(true) }} /> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className={`block h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {online ? 'Online' : 'Offline'}
                </span>
                <span>·</span>
                {outboxCount > 0 ? (
                  <span className="text-amber-400">{outboxCount} pend.</span>
                ) : (
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Sync</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="flex items-center justify-center p-2 rounded-xl bg-orange-500/10 text-orange-400 transition-colors hover:bg-orange-500/20"
                type="button"
                onClick={() => setResetModalOpen(true)}
                title="Limpiar memoria local"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                className={`flex items-center justify-center p-2 rounded-xl bg-zinc-900 text-sky-400 transition-colors hover:bg-zinc-800 disabled:opacity-50 ${syncing ? 'animate-pulse' : ''}`}
                type="button"
                onClick={() => void onSync()}
                disabled={!online || syncing}
                title="Sincronizar ahora"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded-xl bg-rose-500/10 text-rose-400 transition-colors hover:bg-rose-500/20"
                type="button"
                onClick={handleSignOut}
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isHome ? (
            <div className="mt-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-3 shadow-inner">
              <TripSummary activeTripId={activeTripId} tripStartYmd={tripStartYmd} tripEndYmd={tripEndYmd} segments={segments} countries={countries} onConfigure={() => { setIsCreatingNew(false); setConfigOpen(true) }} />
            </div>
          ) : null}

          {lastSyncError ? <div className="mt-3 rounded-xl border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-[10px] text-rose-200">Sync Error: {lastSyncError}</div> : null}
        </header>

        {children}
      </div>
      
      {!isHome ? <BottomNav /> : null}
      
      <TripConfigModal open={configOpen} onClose={() => { setConfigOpen(false); setIsCreatingNew(false) }} isNew={isCreatingNew} />

      <AnimatePresence>
        {resetModalOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl border border-orange-900/40 bg-zinc-950 p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              <div className="flex items-center gap-3 mb-3 text-orange-400">
                <Trash2 className="w-6 h-6" />
                <div className="text-xl font-bold">Limpiar Memoria</div>
              </div>
              <div className="mb-6 text-sm text-zinc-400 leading-relaxed">
                Esto borrará TODOS los datos temporales del almacenamiento en tu dispositivo (gastos, viajes, etc. no sincronizados). Asegúrate de realizar una sincronización primero si tienes elementos pendientes.
                <br /><br />
                Tu sesión se cerrará y deberás volver a ingresar para sincronizar otra vez con la nube. ¿Estás seguro?
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
                  onClick={() => setResetModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/20 hover:bg-orange-500 active:scale-95 transition-all"
                  onClick={() => void performResetLocal()}
                  type="button"
                >
                  Sí, limpiar datos
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className="w-[170px]">
        <SheetSelect
          title="Viajes"
          value={(activeTripId ?? '') as string}
          placeholder="Seleccionar"
          options={[
            ...(trips.length === 0 ? [{ value: '', label: '(Sin viajes)', disabled: true }] : []),
            ...trips.map((t) => ({ value: t.id, label: t.name || 'Sin nombre' })),
            { value: 'NEW', label: '+ Nuevo viaje' },
          ]}
          onChange={(v) => {
            if (v === 'NEW') void handleNewTrip()
            else if (v) setActiveTripId(v)
          }}
          buttonClassName="flex w-full items-center justify-between gap-2 truncate rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-sky-400 outline-none hover:bg-zinc-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
        />
      </div>
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
