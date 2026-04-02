import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import AnimatedIcon from './AnimatedIcon'

export default function CategoryPill({ label, color, icon, iconName }: { label: string; color: string; icon?: ReactNode; iconName?: string | null }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm')}
      style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {iconName ? <AnimatedIcon name={iconName} className="w-3.5 h-3.5" color={color} /> : icon}
      {label}
    </span>
  )
}
