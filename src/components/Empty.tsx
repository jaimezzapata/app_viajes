import { cn } from '@/lib/utils'

export default function Empty({ label = 'Sin datos' }: { label?: string }) {
  return <div className={cn('flex h-full items-center justify-center text-sm text-zinc-400')}>{label}</div>
}
