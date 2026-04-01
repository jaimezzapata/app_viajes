import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, Hotel, ListPlus, Map, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/calendario', label: 'Calend', Icon: CalendarDays },
  { to: '/gastos', label: 'Gastos', Icon: ListPlus },
  { to: '/itinerario', label: 'Itinerar', Icon: Map },
  { to: '/actividades', label: 'Activid', Icon: Ticket },
  { to: '/hospedaje', label: 'Hosped', Icon: Hotel },
  { to: '/reportes', label: 'Report', Icon: BarChart3 },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-zinc-800 bg-zinc-950/85 px-1 pb-2 pt-2 backdrop-blur">
      <div className="grid grid-cols-6 gap-0.5">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-medium transition-colors',
                isActive ? 'bg-zinc-800/70 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
