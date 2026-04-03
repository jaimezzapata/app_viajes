import { create } from 'zustand'
import { newId } from '@/utils/id'

export type NoticeKind = 'success' | 'error' | 'info'

export type Notice = {
  id: string
  kind: NoticeKind
  title?: string
  message: string
  createdAt: number
}

type NoticeInput = {
  kind: NoticeKind
  title?: string
  message: string
  durationMs?: number
}

type NoticeState = {
  items: Notice[]
  show: (input: NoticeInput) => string
  dismiss: (id: string) => void
  clear: () => void
}

const timers = new Map<string, number>()

function scheduleDismiss(id: string, durationMs: number, dismiss: (id: string) => void) {
  const prev = timers.get(id)
  if (prev) window.clearTimeout(prev)
  const t = window.setTimeout(() => dismiss(id), durationMs)
  timers.set(id, t)
}

export const useNoticeStore = create<NoticeState>((set, get) => ({
  items: [],
  show: (input) => {
    const id = newId()
    const createdAt = Date.now()
    const durationMs =
      input.durationMs ??
      (input.kind === 'success' ? 2200 : input.kind === 'info' ? 2600 : 4200)

    const notice: Notice = {
      id,
      kind: input.kind,
      title: input.title,
      message: input.message,
      createdAt,
    }

    set((s) => ({ items: [notice, ...s.items].slice(0, 3) }))
    scheduleDismiss(id, durationMs, get().dismiss)
    return id
  },
  dismiss: (id) => {
    const t = timers.get(id)
    if (t) window.clearTimeout(t)
    timers.delete(id)
    set((s) => ({ items: s.items.filter((n) => n.id !== id) }))
  },
  clear: () => {
    for (const t of timers.values()) window.clearTimeout(t)
    timers.clear()
    set({ items: [] })
  },
}))
