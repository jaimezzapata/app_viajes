import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'

export default function GlobalErrorModal() {
  const [errors, setErrors] = useState<{ id: string; message: string; details: string; time: string }[]>([])

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const msg = event.message || 'Error desconocido'
      let details = ''
      if (event.error?.stack) {
        details = event.error.stack
      } else if (event.filename) {
        details = `${event.filename}:${event.lineno}:${event.colno}`
      }
      
      // Ignore some non-critical errors or extension errors if needed
      if (msg.includes('ResizeObserver')) return

      addError(msg, details)
    }

    function handleRejection(event: PromiseRejectionEvent) {
      let msg = 'Promesa rechazada'
      let details = ''
      
      if (event.reason instanceof Error) {
        msg = event.reason.message
        details = event.reason.stack || ''
      } else if (typeof event.reason === 'string') {
        msg = event.reason
      } else if (event.reason && typeof event.reason === 'object') {
        try {
          details = JSON.stringify(event.reason, null, 2)
        } catch { /* ... */ }
      }

      addError(msg, details)
    }

    function addError(message: string, details: string) {
      setErrors(prev => {
        // Prevent exact duplicates
        if (prev.some(e => e.message === message && e.details === details)) return prev
        const newErr = { id: Math.random().toString(36).substring(2), message, details, time: new Date().toLocaleTimeString('es-CO') }
        return [newErr, ...prev].slice(0, 5) // max 5 errors to avoid UI clutter
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  function dismiss(id: string) {
    setErrors(prev => prev.filter(e => e.id !== id))
  }

  function dismissAll() {
    setErrors([])
  }

  return (
    <AnimatePresence>
      {errors.length > 0 ? (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-4 sm:items-center backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl border border-rose-900/60 bg-zinc-950 p-5 shadow-2xl flex flex-col max-h-[85vh]"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
          >
            <div className="mb-3 flex items-center justify-between shrink-0">
              <div className="text-xl font-bold text-rose-500 flex items-center gap-2">
                <TriangleAlert className="h-6 w-6" />
                <span>Error en la App {errors.length > 1 ? `(${errors.length})` : ''}</span>
              </div>
              {errors.length > 1 && (
                <button
                  className="rounded-xl bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
                  onClick={dismissAll}
                  type="button"
                >
                  Cerrar todos
                </button>
              )}
            </div>
            
            <div className="overflow-y-auto pr-2 flex-1 custom-scrollbar space-y-3">
              {errors.map(err => (
                <div key={err.id} className="rounded-2xl border border-rose-900/30 bg-rose-950/30 p-4 shadow-inner">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-rose-400 break-words flex-1">
                      {err.message}
                    </div>
                    <div className="text-[10px] bg-rose-900/20 px-2 py-1 rounded-md text-zinc-400 whitespace-nowrap shrink-0">{err.time}</div>
                  </div>
                  {err.details && (
                    <div className="mt-3 rounded-xl bg-black/60 p-3 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto custom-scrollbar border border-white/5">
                      {err.details}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-all active:scale-95"
                      onClick={() => dismiss(err.id)}
                      type="button"
                    >
                      Aceptar y continuar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
