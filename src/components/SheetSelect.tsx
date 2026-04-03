import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export type SheetSelectOption<T extends string = string> = {
  value: T
  label: string
  description?: string
  right?: ReactNode
  disabled?: boolean
}

export default function SheetSelect<T extends string = string>({
  title,
  value,
  options,
  onChange,
  disabled,
  buttonClassName,
  placeholder = 'Seleccionar',
}: {
  title: string
  value: T
  options: SheetSelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  buttonClassName?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value])
  const label = selected?.label ?? placeholder

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          'flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50'
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 pb-safe sm:items-center sm:p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                >
                  <motion.div
                    className="flex h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-900 bg-zinc-950 p-4 sm:h-auto sm:max-h-[85dvh] sm:rounded-3xl"
                    initial={{ y: 24 }}
                    animate={{ y: 0 }}
                    exit={{ y: 24 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-zinc-100">{title}</div>
                      <button
                        type="button"
                        className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                        onClick={() => setOpen(false)}
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] custom-scrollbar space-y-2">
                      {options.map((o) => {
                        const active = o.value === value
                        return (
                          <button
                            key={o.value}
                            type="button"
                            disabled={!!o.disabled}
                            className={
                              'w-full rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-50 ' +
                              (active
                                ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                                : 'border-zinc-900 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900')
                            }
                            onClick={() => {
                              onChange(o.value)
                              setOpen(false)
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate">{o.label}</div>
                                {o.description ? <div className="mt-0.5 text-[10px] font-normal text-zinc-500">{o.description}</div> : null}
                              </div>
                              {o.right ? <div className="shrink-0">{o.right}</div> : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  )
}
