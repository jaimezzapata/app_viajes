import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export default function CategoryPill({ label, color, icon }: { label: string; color: string; icon?: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium')}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {icon}
      {label}
    </span>
  )
}
