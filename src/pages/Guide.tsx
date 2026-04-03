import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BedDouble,
  Bell,
  Calendar,
  Camera,
  ChevronDown,
  Download,
  LifeBuoy,
  Link as LinkIcon,
  Menu,
  Plane,
  Route,
  Sparkles,
  Target,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDynamicHead } from '@/hooks/useDynamicHead'
import { useNavigate } from 'react-router-dom'

type NavItem = { id: string; label: string }

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function useScrollProgress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const handler = () => {
      const doc = document.documentElement
      const scrollTop = doc.scrollTop || document.body.scrollTop
      const scrollHeight = doc.scrollHeight - doc.clientHeight
      const p = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0
      setPct(p)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return pct
}

function useScrollSpy(sectionIds: string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  useEffect(() => {
    const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const id = (e.target as HTMLElement).id
          setActiveId(id)
        }
      },
      { root: null, rootMargin: '0px 0px -65% 0px', threshold: 0.12 },
    )

    for (const el of elements) obs.observe(el)
    return () => obs.disconnect()
  }, [sectionIds])

  return activeId
}

function useReveal() {
  const [seen, setSeen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSeen(true)
        }
      },
      { root: null, threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, seen }
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { ref, seen } = useReveal()
  return (
    <section id={id} className="scroll-mt-24" ref={ref as any}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <h2 className="text-xl font-medium text-zinc-900 mb-6">{title}</h2>
        {children}
      </motion.div>
    </section>
  )
}

function AccordionItem({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-zinc-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cx(
          'w-full flex justify-between items-center py-5 text-left transition-colors',
          open ? 'text-zinc-600' : 'text-zinc-900 hover:text-zinc-600',
        )}
      >
        <span className="flex items-center gap-3">
          <span className="text-zinc-400">{icon}</span>
          {title}
        </span>
        <ChevronDown className={cx('w-4 h-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pb-6 pl-8">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default function Guide() {
  useDynamicHead('Manual de usuario', 'Plane')
  const navigate = useNavigate()

  const navItems: NavItem[] = useMemo(
    () => [
      { id: 'introduccion', label: 'Introducción' },
      { id: 'conceptos', label: 'Conceptos Clave' },
      { id: 'flujo', label: 'Flujo de Uso' },
      { id: 'modulos', label: 'Módulos' },
      { id: 'reportes', label: 'Reportes' },
      { id: 'sincronizacion', label: 'Sincronización y Backups' },
      { id: 'diagnostico', label: 'Diagnóstico' },
    ],
    [],
  )

  const sectionIds = useMemo(() => navItems.map((n) => n.id), [navItems])
  const activeId = useScrollSpy(sectionIds)
  const progress = useScrollProgress()

  const [mobileOpen, setMobileOpen] = useState(false)

  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({
    calendar: false,
    itinerary: false,
    lodging: false,
    activities: false,
    expenses: false,
  })

  function backToApp() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/inicio')
  }

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="bg-white text-zinc-600 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900 min-h-[100dvh]">
      <div
        className="fixed top-0 left-0 h-[2px] z-50"
        style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, #2563eb, #0ea5e9)' }}
      />

      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-zinc-100 p-4 sticky top-0 z-40 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={backToApp}
          className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Volver a la app"
          title="Volver a la app"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <a href="#top" className="font-medium text-zinc-900 flex items-center gap-2 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 shrink-0">
            <Plane className="w-5 h-5" />
          </span>
          <span className="truncate">App Viajes</span>
        </a>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-white" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute inset-y-0 right-0 w-full max-w-sm bg-white pt-20 px-6 pb-8 overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm font-medium text-zinc-900">Manual de Usuario</div>
                  <div className="text-xs text-zinc-400 mt-1 uppercase tracking-widest">Guía práctica</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-6 text-lg">
                {navItems.map((n) => (
                  <a
                    key={n.id}
                    href={`#${n.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={cx(
                      'transition-colors',
                      activeId === n.id ? 'text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900',
                    )}
                  >
                    {n.label}
                  </a>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div id="top" className="flex max-w-7xl mx-auto">
        <aside className="hidden md:block w-64 h-screen sticky top-0 py-12 pr-8 border-r border-zinc-100">
          <div className="mb-10 pl-4">
            <a href="#top" className="font-medium text-zinc-900 flex items-center gap-2 text-lg">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                <Plane className="w-5 h-5" />
              </span>
              <span>App Viajes</span>
            </a>
            <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">Manual de Usuario</p>
            <button
              type="button"
              onClick={backToApp}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
              title="Volver a la app"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la app
            </button>
          </div>

          <nav className="flex flex-col text-sm" id="sidebar-nav">
            {navItems.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={cx(
                  'nav-link block py-2 pl-4 border-l-2 border-transparent text-zinc-400 hover:text-zinc-900 transition-colors rounded-lg',
                  activeId === n.id && 'active',
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="mt-10 pl-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-700">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">Tip rápido</div>
                  <div className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    Si vas a viajar sin internet, registra todo con normalidad. Cuando vuelvas a estar en línea, la app enviará tus cambios.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-6 py-12 md:py-20 md:px-16 lg:px-24 max-w-4xl">
          <header className="mb-20 flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-light text-zinc-900 tracking-tight mb-6">Guía Práctica</h1>
              <p className="text-lg leading-relaxed text-zinc-500 font-light">
                Aprende a planificar, registrar y controlar tu viaje día a día. Esta guía te explica de forma directa cómo aprovechar las funciones principales de la aplicación.
              </p>
            </div>

            <div className="flex-1 w-full bg-zinc-50 rounded-2xl border border-zinc-200 p-5 shadow-sm relative overflow-hidden">
              <div className="flex gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end mb-2">
                  <div className="h-5 bg-zinc-200 rounded w-1/3"></div>
                  <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <span className="inline-flex">
                      <Target className="w-4 h-4" />
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="h-10 bg-white border border-zinc-100 rounded flex flex-col items-center justify-center gap-1 shadow-sm">
                    <div className="w-4 h-1 bg-zinc-200 rounded"></div>
                  </div>
                  <div className="h-10 bg-blue-600 rounded flex flex-col items-center justify-center gap-1 shadow-sm">
                    <div className="w-4 h-1 bg-blue-300 rounded"></div>
                  </div>
                  <div className="h-10 bg-white border border-zinc-100 rounded flex flex-col items-center justify-center gap-1 shadow-sm">
                    <div className="w-4 h-1 bg-zinc-200 rounded"></div>
                  </div>
                  <div className="h-10 bg-white border border-zinc-100 rounded flex flex-col items-center justify-center gap-1 shadow-sm">
                    <div className="w-4 h-1 bg-zinc-200 rounded"></div>
                  </div>
                </div>
                <div className="h-16 bg-white border border-zinc-100 rounded-lg shadow-sm flex items-center px-4 gap-4">
                  <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-2 bg-zinc-200 rounded w-1/2"></div>
                    <div className="h-2 bg-zinc-100 rounded w-1/4"></div>
                  </div>
                </div>
                <div className="h-16 bg-white border border-zinc-100 rounded-lg shadow-sm flex items-center px-4 gap-4">
                  <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-2 bg-zinc-200 rounded w-2/3"></div>
                    <div className="h-2 bg-zinc-100 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-24">
            <Section id="introduccion" title="1. Introducción">
              <div className="space-y-4 font-light leading-relaxed">
                <p>
                  App Viajes es una herramienta diseñada para gestionar cada aspecto de tu viaje: desde la agenda diaria (vuelos, hoteles, tours) hasta el control detallado de tu presupuesto en diferentes monedas.
                </p>
                <p>
                  La aplicación centraliza tu información para que sepas en todo momento dónde debes estar, qué reservas tienes y cuánto dinero has gastado en comparación con lo que planeaste.
                </p>
              </div>
            </Section>

            <Section id="conceptos" title="2. Conceptos Clave">
              <div className="grid md:grid-cols-3 gap-6 font-light">
                <div className="bg-white border border-zinc-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                    <WifiOff className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-medium text-zinc-900 mb-3">Offline-First</h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Guarda tu información incluso sin internet. Cuando vuelvas a tener conexión, la app sincroniza de forma automática.
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
                    <LinkIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-medium text-zinc-900 mb-3">Gastos Espejo</h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Agrega costo a un Vuelo, Hotel o Actividad y se creará un gasto automático. No necesitas duplicar el registro en la sección financiera.
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
                    <Route className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-medium text-zinc-900 mb-3">Tramos (Etapas)</h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Define en qué fechas estarás en qué país. Al registrar un gasto, la app detecta la fecha y te ayuda a elegir la moneda correcta.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="flujo" title="3. Flujo General de Uso">
              <div className="relative font-light mt-10">
                <div className="hidden md:block absolute top-6 left-10 right-10 h-[2px] bg-zinc-100 z-0"></div>
                <div className="md:hidden absolute top-10 bottom-10 left-6 w-[2px] bg-zinc-100 z-0"></div>

                <div className="grid md:grid-cols-3 gap-10 md:gap-6 relative z-10">
                  <div className="flex md:flex-col items-start md:items-center gap-4 text-left md:text-center">
                    <div className="w-12 h-12 rounded-full bg-white border-2 border-blue-600 text-blue-600 font-medium flex items-center justify-center text-lg shrink-0 shadow-sm">
                      1
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-zinc-900 mb-2">Configurar Viaje</h3>
                      <p className="text-sm leading-relaxed text-zinc-500">
                        Selecciona “Crear Viaje Nuevo”. Define fechas, tipo y agrega los países y sus monedas.
                      </p>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-start md:items-center gap-4 text-left md:text-center">
                    <div className="w-12 h-12 rounded-full bg-white border-2 border-zinc-300 text-zinc-400 font-medium flex items-center justify-center text-lg shrink-0 shadow-sm">
                      2
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-zinc-900 mb-2">Definir Tramos</h3>
                      <p className="text-sm leading-relaxed text-zinc-500">
                        Establece las fechas por país para que el calendario y los gastos queden bien organizados.
                      </p>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-start md:items-center gap-4 text-left md:text-center">
                    <div className="w-12 h-12 rounded-full bg-white border-2 border-zinc-300 text-zinc-400 font-medium flex items-center justify-center text-lg shrink-0 shadow-sm">
                      3
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-zinc-900 mb-2">Día a Día</h3>
                      <p className="text-sm leading-relaxed text-zinc-500">
                        Usa Itinerario, Hospedaje y Actividades para tu agenda, y agrega Gastos sobre la marcha.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="modulos" title="4. Módulos Principales">
              <p className="font-light mb-8">Haz clic en cada módulo para conocer sus detalles y reglas de uso.</p>
              <div className="border-t border-zinc-100 font-light">
                <AccordionItem
                  icon={<Calendar className="w-5 h-5" />}
                  title="Calendario"
                  open={openAcc.calendar}
                  onToggle={() => setOpenAcc((s) => ({ ...s, calendar: !s.calendar }))}
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="text-zinc-500 flex-1">
                      <p className="mb-3">Es tu centro de operaciones. Cuenta con dos vistas principales para la organización:</p>
                      <ul className="list-disc list-outside ml-4 space-y-2">
                        <li>
                          <strong>Vista Mes:</strong> Muestra un resumen rápido de cada día en celdas.
                        </li>
                        <li>
                          <strong>Agenda:</strong> Al seleccionar un día, verás el detalle ordenado de tus vuelos, reservas, actividades y gastos.
                        </li>
                      </ul>
                    </div>
                    <div className="w-full md:w-48 bg-zinc-50 border border-zinc-200 rounded-lg p-3 shrink-0">
                      <div className="flex justify-between items-center mb-3">
                        <div className="h-3 bg-zinc-300 rounded w-16"></div>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-zinc-300 rounded-full"></div>
                          <div className="w-2 h-2 bg-zinc-300 rounded-full"></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-4 bg-zinc-200 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                        <div className="h-6 bg-blue-100 border border-blue-200 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                        <div className="h-6 bg-white border border-zinc-100 rounded-sm"></div>
                      </div>
                    </div>
                  </div>
                </AccordionItem>

                <AccordionItem
                  icon={<Route className="w-5 h-5" />}
                  title="Itinerario (Trayectos)"
                  open={openAcc.itinerary}
                  onToggle={() => setOpenAcc((s) => ({ ...s, itinerary: !s.itinerary }))}
                >
                  <div className="pb-0 flex flex-col md:flex-row gap-8 items-start">
                    <div className="text-zinc-500 flex-1">
                      <p className="mb-3">Aquí registras cómo te mueves: vuelos, trenes, buses, auto.</p>
                      <ul className="list-disc list-outside ml-4 space-y-2">
                        <li>Indica origen, destino y horarios. En vuelos, puedes agregar aerolíneas y escalas.</li>
                        <li>
                          <strong>Costo:</strong> Si ingresas un valor, se crea automáticamente un gasto asociado en la categoría Transporte.
                        </li>
                      </ul>
                    </div>
                    <div className="w-full md:w-48 bg-white border border-zinc-200 rounded-lg p-3 shrink-0 shadow-sm relative">
                      <div className="absolute left-6 top-6 bottom-6 w-[2px] border-l-2 border-dashed border-zinc-200"></div>
                      <div className="flex gap-3 items-center mb-4 relative z-10">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-600 bg-white"></div>
                        <div className="h-2 bg-zinc-200 rounded w-16"></div>
                      </div>
                      <div className="flex gap-3 items-center relative z-10">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-600 bg-white"></div>
                        <div className="h-2 bg-zinc-200 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                </AccordionItem>

                <AccordionItem
                  icon={<BedDouble className="w-5 h-5" />}
                  title="Hospedaje"
                  open={openAcc.lodging}
                  onToggle={() => setOpenAcc((s) => ({ ...s, lodging: !s.lodging }))}
                >
                  <div className="text-zinc-500">
                    <p>
                      Para registrar hoteles, Airbnb o cualquier alojamiento. Ingresa ciudad, fechas de Check-in y Check-out, y dirección. Al igual que en rutas, si ingresas el costo total de la reserva, se genera un gasto automático vinculado en tu presupuesto.
                    </p>
                  </div>
                </AccordionItem>

                <AccordionItem
                  icon={<Camera className="w-5 h-5" />}
                  title="Actividades"
                  open={openAcc.activities}
                  onToggle={() => setOpenAcc((s) => ({ ...s, activities: !s.activities }))}
                >
                  <div className="text-zinc-500">
                    <p>
                      Registra tours, visitas a museos, eventos o reservas en restaurantes. Mantiene tu agenda diaria organizada (con horas de inicio y fin) y genera su propio registro de gasto si tuvieron un costo asociado o entradas previas.
                    </p>
                  </div>
                </AccordionItem>

                <AccordionItem
                  icon={<Wallet className="w-5 h-5" />}
                  title="Gastos"
                  open={openAcc.expenses}
                  onToggle={() => setOpenAcc((s) => ({ ...s, expenses: !s.expenses }))}
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="text-zinc-500 space-y-4 flex-1">
                      <p>El corazón financiero. Aquí registras compras sueltas (comida, regalos, imprevistos).</p>
                      <div className="bg-amber-50 p-4 rounded text-sm text-amber-800 border-l-2 border-amber-500">
                        <strong>Importante:</strong> No puedes crear manualmente gastos de tipo “Hospedaje”, “Transporte” o “Entretenimiento” desde aquí. Esos deben crearse desde sus módulos respectivos.
                      </div>
                      <p>Si registras un gasto en moneda extranjera, la app calculará la conversión a tu moneda local según la fecha.</p>
                    </div>
                    <div className="w-full md:w-48 bg-zinc-50 border border-zinc-200 rounded-lg p-3 shrink-0 flex flex-col gap-2">
                      <div className="bg-white p-2 border border-zinc-100 rounded flex justify-between items-center shadow-sm">
                        <div className="flex gap-2 items-center">
                          <div className="w-4 h-4 rounded-full bg-red-100"></div>
                          <div className="h-2 bg-zinc-200 rounded w-12"></div>
                        </div>
                        <div className="h-2 bg-zinc-300 rounded w-8"></div>
                      </div>
                      <div className="bg-white p-2 border border-zinc-100 rounded flex justify-between items-center shadow-sm">
                        <div className="flex gap-2 items-center">
                          <div className="w-4 h-4 rounded-full bg-green-100"></div>
                          <div className="h-2 bg-zinc-200 rounded w-16"></div>
                        </div>
                        <div className="h-2 bg-zinc-300 rounded w-10"></div>
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              </div>
            </Section>

            <Section id="reportes" title="5. Reportes y Presupuestos">
              <div className="grid sm:grid-cols-3 gap-8 font-light">
                <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-100 text-center flex flex-col items-center">
                  <div className="w-16 h-16 flex items-end justify-center gap-1 mb-4">
                    <div className="w-3 bg-blue-200 rounded-t h-2/5"></div>
                    <div className="w-3 bg-blue-400 rounded-t h-3/5"></div>
                    <div className="w-3 bg-blue-600 rounded-t h-full"></div>
                  </div>
                  <h3 className="text-sm font-medium text-zinc-900 mb-2 uppercase tracking-wide">Totales</h3>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Visualiza el gasto frente al presupuesto global y el detalle por país y categoría.
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-100 text-center flex flex-col items-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-4 relative">
                    <div className="absolute inset-0 border-4 border-amber-200 rounded-full border-t-amber-500 rotate-45"></div>
                    <Bell className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-900 mb-2 uppercase tracking-wide">Alertas</h3>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Avisos si te pasaste del presupuesto o si falta actualizar la tasa de cambio.
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-100 text-center flex flex-col items-center">
                  <div className="w-16 h-16 flex flex-col justify-center gap-2 mb-4">
                    <div className="h-2 bg-zinc-300 rounded w-full"></div>
                    <div className="h-2 bg-zinc-200 rounded w-4/5"></div>
                    <div className="h-2 bg-zinc-200 rounded w-3/5"></div>
                  </div>
                  <h3 className="text-sm font-medium text-zinc-900 mb-2 uppercase tracking-wide">Top Gastos</h3>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Un listado rápido con los 10 registros financieros más altos de tu viaje.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="sincronizacion" title="6. Sincronización y Backups">
              <div className="space-y-6 font-light">
                <p className="leading-relaxed">
                  Aunque la app sincroniza automáticamente cuando detecta internet, puedes forzar el envío de datos usando el botón <strong>Sincronizar</strong> en la interfaz principal.
                </p>
                <p className="leading-relaxed">Desde la pestaña de Reportes puedes exportar tu información:</p>
                <ul className="list-none space-y-3 pl-4 border-l border-zinc-200">
                  <li>
                    <span className="font-medium text-zinc-900">PDF Ejecutivo:</span> Resumen visual de tu viaje.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-900">Excel Consolidado:</span> Todos los datos en formato tabla.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-900">Backup:</span> Guarda la configuración completa de tu viaje. Ideal para restaurar datos o hacer limpieza.
                  </li>
                </ul>
              </div>
            </Section>

            <Section id="diagnostico" title="7. Diagnóstico">
              <div className="space-y-4 font-light">
                <p className="leading-relaxed">
                  Si notas que algo no cuadra (gastos que no aparecen, días vacíos), la sección de <strong>Diagnóstico</strong> (accesible desde Reportes) te ayudará a identificar el problema.
                </p>
                <p className="leading-relaxed">Detecta automáticamente fallas como:</p>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  <li>Tramos de fechas que se superponen.</li>
                  <li>Gastos asignados a países no configurados.</li>
                  <li>Registros con fechas fuera del rango oficial de tu viaje.</li>
                </ul>
                <div className="mt-8 pt-8 border-t border-zinc-100 text-xs text-zinc-400 flex justify-between items-center">
                  <span>App Viajes © Manual de Usuario.</span>
                  <span>Diseñado para simplificar tu ruta.</span>
                </div>
              </div>
            </Section>
          </div>
        </main>
      </div>
    </div>
  )
}
