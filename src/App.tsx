import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/supabase/client'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import AppShell from '@/components/AppShell'
import AuthScreen from '@/components/AuthScreen'
import GlobalErrorModal from '@/components/GlobalErrorModal'
import Calendar from '@/pages/Calendar'
import Expenses from '@/pages/Expenses'
import Itinerary from '@/pages/Itinerary'
import Lodging from '@/pages/Lodging'
import Activities from '@/pages/Activities'
import Reports from '@/pages/Reports'
import Diagnostics from '@/pages/Diagnostics'
import Home from '@/pages/Home'
import SharedTrip from './pages/SharedTrip'

function TripSyncer() {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const loadTrip = useTripStore((s) => s.loadTrip)

  const { value: trip } = useLiveQuery(
    async () => (activeTripId ? await db.viajes.get(activeTripId) : undefined),
    [activeTripId],
    undefined
  )

  useEffect(() => {
    if (activeTripId && trip && trip.id === activeTripId) {
      loadTrip(trip)
    }
  }, [activeTripId, trip, loadTrip])

  return null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b1220]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500" /></div>
  }

  if (!supabase) {
    return (
      <>
        <GlobalErrorModal />
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b1220] px-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-6 text-zinc-100">
            <div className="text-lg font-bold">Configuración incompleta</div>
            <div className="mt-2 text-sm text-zinc-400">
              Faltan variables de entorno de Supabase (URL y ANON KEY). La app puede abrir pero no puede autenticarse ni sincronizar.
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <GlobalErrorModal />
      <BrowserRouter>
        <Routes>
          <Route path="/compartir/:token" element={<SharedTrip />} />
          <Route
            path="*"
            element={
              session ? (
                <>
                  <TripSyncer />
                  <AppShell>
                    <AnimatedRoutes />
                  </AppShell>
                </>
              ) : (
                <AuthScreen />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/itinerario" element={<Itinerary />} />
        <Route path="/actividades" element={<Activities />} />
        <Route path="/hospedaje" element={<Lodging />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/diagnostico" element={<Diagnostics />} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
