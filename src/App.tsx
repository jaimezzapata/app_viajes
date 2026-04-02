import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/supabase/client'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/db/appDb'
import { useTripStore } from '@/stores/tripStore'
import AppShell from '@/components/AppShell'
import AuthScreen from '@/components/AuthScreen'
import Calendar from '@/pages/Calendar'
import Expenses from '@/pages/Expenses'
import Itinerary from '@/pages/Itinerary'
import Lodging from '@/pages/Lodging'
import Activities from '@/pages/Activities'
import Reports from '@/pages/Reports'
import Home from '@/pages/Home'

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

import GlobalErrorModal from '@/components/GlobalErrorModal'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  if (!session) {
    return (
      <>
        <GlobalErrorModal />
        <AuthScreen />
      </>
    )
  }

  return (
    <>
      <GlobalErrorModal />
      <BrowserRouter>
        <TripSyncer />
        <AppShell>
          <AnimatedRoutes />
        </AppShell>
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
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
