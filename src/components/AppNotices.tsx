import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useNoticeStore } from '@/stores/noticeStore'

function kindStyles(kind: 'success' | 'error' | 'info') {
  if (kind === 'success') {
    return { icon: CheckCircle2, ring: 'ring-emerald-500/20', iconClass: 'text-emerald-400' }
  }
  if (kind === 'error') {
    return { icon: AlertTriangle, ring: 'ring-rose-500/20', iconClass: 'text-rose-400' }
  }
  return { icon: Info, ring: 'ring-sky-500/20', iconClass: 'text-sky-400' }
}

export default function AppNotices() {
  const items = useNoticeStore((s) => s.items)
  const dismiss = useNoticeStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[9998] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 space-y-2">
      <AnimatePresence initial={false}>
        {items.map((n) => {
          const s = kindStyles(n.kind)
          const Icon = s.icon
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/80 p-3 shadow-2xl backdrop-blur ${s.ring} ring-1`}
            >
              <div className="mt-0.5 shrink-0">
                <Icon className={`h-5 w-5 ${s.iconClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                {n.title ? <div className="text-xs font-semibold text-zinc-100">{n.title}</div> : null}
                <div className="text-xs text-zinc-300">{n.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(n.id)}
                className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

