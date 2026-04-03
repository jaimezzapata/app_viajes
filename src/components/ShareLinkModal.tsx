import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Link as LinkIcon, X } from 'lucide-react'
import { useNoticeStore } from '@/stores/noticeStore'

export default function ShareLinkModal({
  open,
  url,
  onClose,
}: {
  open: boolean
  url: string
  onClose: () => void
}) {
  const show = useNoticeStore((s) => s.show)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md rounded-3xl border border-zinc-900 bg-zinc-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Compartir</div>
                <div className="mt-1 text-lg font-bold text-zinc-100">Link del itinerario</div>
                <div className="mt-1 text-xs text-zinc-400">Copia y envía este link para abrir el viaje en modo lectura.</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="shrink-0 text-zinc-500">
                  <LinkIcon className="h-4 w-4" />
                </div>
                <input
                  value={url}
                  readOnly
                  className="w-full min-w-0 bg-transparent text-xs text-zinc-200 outline-none"
                />
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url)
                      show({ kind: 'success', message: 'Link copiado al portapapeles.' })
                    } catch {
                      show({ kind: 'error', message: 'No se pudo copiar. Copia el link manualmente.' })
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

