import { motion } from 'framer-motion'
import {
  Hotel, Plane, PlaneTakeoff, Train, Bus, Utensils,
  Shirt, Candy, Smartphone, Gift, ShoppingBag, Home,
  Ticket, Luggage, Package, Lock, TriangleAlert,
  HelpCircle, LucideIcon, Receipt, Map, CalendarDays, BarChart3, TramFront, Footprints, MapPin, Camera
} from 'lucide-react'

// Mapeo seguro de nombres de BD a componentes de Lucide para evitar que el empaquetador incluya los miles de iconos de la librería en el JS
export const categoryIconMap: Record<string, LucideIcon> = {
  Hotel, Plane, PlaneTakeoff, Train, Bus, Utensils,
  Shirt, Candy, Smartphone, Gift, ShoppingBag, Home,
  Ticket, Luggage, Package, Lock, TriangleAlert,
  Receipt, Map, CalendarDays, BarChart3, TramFront, Footprints, MapPin, Camera
}

interface AnimatedIconProps {
  name: string
  color?: string
  className?: string
}

export default function AnimatedIcon({ name, color, className = "w-4 h-4" }: AnimatedIconProps) {
  const Icon = categoryIconMap[name] || HelpCircle

  return (
    <motion.div
      whileHover={{ scale: 1.2, rotate: [-5, 5, -5, 0] }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ 
        color: color || 'currentColor',
        filter: color ? `drop-shadow(0px 2px 4px ${color}40)` : undefined
      }}
    >
      <Icon className="w-full h-full" strokeWidth={2.5} />
    </motion.div>
  )
}
