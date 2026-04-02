import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTripStore, type TripCountry, type TripSegment, type TripStage, clampYmd, normalizeSegment } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { toYmd, addDays } from '@/utils/date'
import { db } from '@/db/appDb'
import type { AppBudget } from '@/../shared/types'

export default function TripConfigModal({ open, onClose, isNew }: { open: boolean; onClose: () => void; isNew?: boolean }) {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const globalStartYmd = useTripStore((s) => s.tripStartYmd)
  const globalEndYmd = useTripStore((s) => s.tripEndYmd)
  const segments = useTripStore((s) => s.segments)
  const countries = useTripStore((s) => s.countries)
  const isNational = useTripStore((s) => s.isNational)
  const setActiveTripId = useTripStore((s) => s.setActiveTripId)
  const navigate = useNavigate()

  const [tripName, setTripName] = useState('Mi Viaje')
  const [localIsNational, setLocalIsNational] = useState(isNational)
  const [localStartYmd, setLocalStartYmd] = useState(globalStartYmd)
  const [localEndYmd, setLocalEndYmd] = useState(globalEndYmd)
  const [localSegments, setLocalSegments] = useState<TripSegment[]>(segments)
  const [localCountries, setLocalCountries] = useState<TripCountry[]>(countries)
  const [newCountryName, setNewCountryName] = useState('')
  const [newCountryAcronym, setNewCountryAcronym] = useState('')
  const [newCountryCurrency, setNewCountryCurrency] = useState('')
  const [newCountryFlag, setNewCountryFlag] = useState('')
  const [editingCountryCode, setEditingCountryCode] = useState<string | null>(null)
  const [renamedCodes, setRenamedCodes] = useState<Record<string, string>>({})
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false)
  const [editingSegData, setEditingSegData] = useState<{ mode: 'add'|'edit', seg: TripSegment } | null>(null)
  
  const [step, setStep] = useState<'config' | 'budget'>('config')
  const [initialBudget, setInitialBudget] = useState('')

  const segmentsEndRef = useRef<HTMLDivElement>(null)

  const touchedRef = useRef({ acronym: false, currency: false, flag: false })
  const lastNameRef = useRef('')
  const reqIdRef = useRef(0)

  const initOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      initOpenRef.current = false
      return
    }
    if (initOpenRef.current) return
    initOpenRef.current = true

    setStep('config')
    setInitialBudget('')
    setEditingSegData(null)
    setDeleteWarningOpen(false)

    if (isNew) {
      setTripName('Nuevo Viaje')
      const today = new Date()
      setLocalStartYmd(toYmd(today))
      setLocalEndYmd(toYmd(addDays(today, 29)))
      setLocalIsNational(false)
      setLocalSegments([])
      setLocalCountries([{ code: 'COLOMBIA', acronym: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP' }])
    } else {
      setLocalStartYmd(globalStartYmd)
      setLocalEndYmd(globalEndYmd)
      setLocalIsNational(isNational)
      setLocalSegments(segments)
      setLocalCountries(countries)
      if (activeTripId) {
        db.viajes.get(activeTripId).then((t) => {
          if (t) {
            if (t.name) setTripName(t.name)
            if (t.is_national != null) setLocalIsNational(t.is_national)
          }
        })
      }
    }
  }, [open, isNew, activeTripId, countries, segments, globalStartYmd, globalEndYmd, isNational])

  const stageOptions = useMemo(
    () => localCountries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [localCountries],
  )

  function updateSeg(id: string, patch: Partial<TripSegment>) {
    setLocalSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function openAddSeg() {
    const last = localSegments[localSegments.length - 1]
    const baseStart = last?.endYmd ?? localStartYmd
    const id = `seg_${newId().slice(0, 8)}`
    const first = localCountries[0]?.code ?? 'COLOMBIA'
    const second = localCountries[1]?.code ?? first
    const seg: TripSegment = {
      id,
      fromStage: last?.toStage ?? first,
      toStage: last?.toStage ? (last?.toStage === first ? second : first) : second,
      startYmd: baseStart,
      endYmd: baseStart,
    }
    setEditingSegData({ mode: 'add', seg })
  }

  function saveSeg(seg: TripSegment) {
    if (editingSegData?.mode === 'add') {
      setLocalSegments((prev) => {
        const next = [...prev, seg]
        setTimeout(() => segmentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
        return next
      })
    } else {
      setLocalSegments((prev) => prev.map(s => s.id === seg.id ? seg : s))
    }
    setEditingSegData(null)
  }

  function removeSeg(id: string) {
    setLocalSegments((prev) => prev.filter((s) => s.id !== id))
  }

  function normalizeCountryCode(name: string) {
    const base = name
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return base || `PAIS_${newId().slice(0, 4).toUpperCase()}`
  }

  function cca2ToFlag(cca2: string) {
    const c = cca2.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(c)) return '🏳️'
    const a = 0x1f1e6
    const first = a + (c.charCodeAt(0) - 65)
    const second = a + (c.charCodeAt(1) - 65)
    return String.fromCodePoint(first, second)
  }

  useEffect(() => {
    if (!open) return
    const name = newCountryName.trim()

    if (!name) {
      setNewCountryAcronym('')
      setNewCountryCurrency('')
      setNewCountryFlag('')
      touchedRef.current = { acronym: false, currency: false, flag: false }
      lastNameRef.current = ''
      return
    }

    if (name !== lastNameRef.current) {
      if (!touchedRef.current.acronym) setNewCountryAcronym('')
      if (!touchedRef.current.currency) setNewCountryCurrency('')
      if (!touchedRef.current.flag) setNewCountryFlag('')
      lastNameRef.current = name
    }

    if (name.length < 3) return
    if (!navigator.onLine) return

    const ctrl = new AbortController()
    const reqId = ++reqIdRef.current
    const handle = window.setTimeout(async () => {
      try {
        const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=cca2,currencies,name`
        const resp = await fetch(url, { signal: ctrl.signal })
        if (!resp.ok) return
        const data = (await resp.json()) as Array<{ cca2?: string; currencies?: Record<string, unknown> }>
        const first = data?.[0]
        const cca2 = String(first?.cca2 ?? '').toUpperCase()
        const currency = first?.currencies && !localIsNational ? Object.keys(first.currencies)[0] : 'COP'
        if (reqId !== reqIdRef.current) return
        if (newCountryName.trim() !== name) return

        if (cca2 && !touchedRef.current.acronym) setNewCountryAcronym(cca2)
        if (currency && !touchedRef.current.currency) setNewCountryCurrency(currency.toUpperCase())
        if (cca2 && !touchedRef.current.flag && !localIsNational) setNewCountryFlag(cca2ToFlag(cca2))
      } catch {
        return
      }
    }, 450)

    return () => {
      window.clearTimeout(handle)
      ctrl.abort()
    }
  }, [newCountryName, open])

  function editCountry(c: TripCountry) {
    setEditingCountryCode(c.code)
    setNewCountryName(c.name)
    setNewCountryAcronym(c.acronym)
    setNewCountryCurrency(c.currency)
    setNewCountryFlag(c.flag)
    touchedRef.current = { acronym: true, currency: true, flag: true }
    lastNameRef.current = c.name
  }

  function cancelEdit() {
    setEditingCountryCode(null)
    setNewCountryName('')
    setNewCountryAcronym('')
    setNewCountryCurrency('')
    setNewCountryFlag('')
    touchedRef.current = { acronym: false, currency: false, flag: false }
    lastNameRef.current = ''
  }

  function saveCountry() {
    const name = newCountryName.trim()
    const acronym = newCountryAcronym.trim().toUpperCase() || name.slice(0, 2).toUpperCase()
    const currency = localIsNational ? 'COP' : newCountryCurrency.trim().toUpperCase()
    const flag = localIsNational ? '📍' : (newCountryFlag.trim() || '🏳️')
    if (!name) return
    if (!currency) return

    if (editingCountryCode) {
      let code = normalizeCountryCode(name)
      if (code !== editingCountryCode) {
        const existing = new Set(localCountries.map((c) => c.code))
        if (existing.has(code)) {
          let i = 2
          while (existing.has(`${code}_${i}`)) i++
          code = `${code}_${i}`
        }
        setRenamedCodes((r) => ({ ...r, [editingCountryCode]: code }))
        setLocalSegments((segs) =>
          segs.map((s) => ({
            ...s,
            fromStage: s.fromStage === editingCountryCode ? code : s.fromStage,
            toStage: s.toStage === editingCountryCode ? code : s.toStage,
          })),
        )
      } else {
        code = editingCountryCode
      }

      setLocalCountries((prev) => prev.map((c) => (c.code === editingCountryCode ? { ...c, code, name, acronym, flag, currency } : c)))
      cancelEdit()
      return
    }

    let code = normalizeCountryCode(name)
    const existing = new Set(localCountries.map((c) => c.code))
    if (existing.has(code)) {
      let i = 2
      while (existing.has(`${code}_${i}`)) i++
      code = `${code}_${i}`
    }

    setLocalCountries((prev) => [...prev, { code, acronym, name, flag, currency }])
    cancelEdit()
  }

  function removeCountry(code: string) {
    setLocalCountries((prev) => {
      const next = prev.filter((c) => c.code !== code)
      const fallback = next[0]?.code ?? 'COLOMBIA'
      setLocalSegments((segs) =>
        segs.map((s) => ({
          ...s,
          fromStage: s.fromStage === code ? fallback : s.fromStage,
          toStage: s.toStage === code ? fallback : s.toStage,
        })),
      )
      return next
    })
  }

  async function onSave() {
    const normalized = localSegments
      .map((s) => normalizeSegment(s))
      .map((s) => ({
        ...s,
        startYmd: clampYmd(s.startYmd, localStartYmd, localEndYmd),
        endYmd: clampYmd(s.endYmd, localStartYmd, localEndYmd),
      }))
      .sort((a, b) => a.startYmd.localeCompare(b.startYmd))

    const ts = nowIso()
    const targetId = isNew ? newId() : activeTripId
    
    if (targetId) {
      let baseTrip = await db.viajes.get(targetId)
      if (!baseTrip) {
        baseTrip = {
          id: targetId,
          user_id: null,
          name: tripName,
          start_date: localStartYmd,
          end_date: localEndYmd,
          is_national: localIsNational,
          countries_json: JSON.stringify(localCountries),
          segments_json: JSON.stringify(normalized),
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        }
      }

      const nextTrip = {
        ...baseTrip,
        name: tripName,
        is_national: localIsNational,
        start_date: localStartYmd,
        end_date: localEndYmd,
        countries_json: JSON.stringify(localCountries),
        segments_json: JSON.stringify(normalized),
        updated_at: ts,
      }
      
      await db.viajes.put(nextTrip)
      await db.outbox.add({
        id: newId(),
        table_name: 'viajes',
        op: 'UPSERT',
        entity_id: targetId,
        payload: nextTrip,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })

      if (isNew) {
        setActiveTripId(targetId)
      }
    }

    const renames = Object.entries(renamedCodes)
    if (renames.length > 0) {
      try {
        await db.transaction('rw', [db.gastos, db.itinerarios, db.hospedajes, db.presupuestos, db.actividades, db.outbox], async () => {
          for (const [oldCode, newCode] of renames) {
            for (const table of [db.gastos, db.itinerarios, db.hospedajes, db.presupuestos, db.actividades]) {
              const items = await table.where('stage').equals(oldCode).toArray()
              for (const item of items) {
                const nextItem = { ...item, stage: newCode, updated_at: ts }
                await table.put(nextItem as any)
                await db.outbox.add({
                  id: newId(),
                  table_name: table.name as any,
                  op: 'UPSERT',
                  entity_id: item.id,
                  payload: nextItem,
                  created_at: ts,
                  try_count: 0,
                  last_error: null,
                })
              }
            }
          }
        })
      } catch (err) {
        console.error('Migration error renaming stages', err)
      }
    }

    if (isNew) {
      setStep('budget')
    } else {
      onClose()
    }
  }

  async function onSaveBudget() {
    const raw = initialBudget.replace(/\./g, '').replace(',', '.')
    const parsed = Number(raw)
    const amount = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
    
    if (amount > 0 && activeTripId) {
      const ts = nowIso()
      const item: AppBudget = {
        id: newId(),
        user_id: null,
        trip_id: activeTripId,
        stage: 'GLOBAL',
        category_id: null,
        amount_cop: amount,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }
      await db.transaction('rw', db.presupuestos, db.outbox, async () => {
        await db.presupuestos.put(item)
        await db.outbox.add({
          id: newId(),
          table_name: 'presupuestos',
          op: 'UPSERT',
          entity_id: item.id,
          payload: item,
          created_at: ts,
          try_count: 0,
          last_error: null,
        })
      })
    }

    navigate('/gastos')
    onClose()
  }

  async function handleDeleteTrip() {
    if (!activeTripId || isNew) return
    const ts = nowIso()
    // hard delete the trip and related local entities
    await db.transaction('rw', [db.viajes, db.gastos, db.itinerarios, db.actividades, db.hospedajes, db.presupuestos, db.outbox], async () => {
      await db.viajes.delete(activeTripId)
      await db.outbox.add({
        id: newId(),
        table_name: 'viajes',
        op: 'DELETE',
        entity_id: activeTripId,
        payload: null,
        created_at: ts,
        try_count: 0,
        last_error: null,
      })
      
      const tables = [
        { t: db.gastos, name: 'gastos' },
        { t: db.itinerarios, name: 'itinerarios' },
        { t: db.actividades, name: 'actividades' },
        { t: db.hospedajes, name: 'hospedajes' },
        { t: db.presupuestos, name: 'presupuestos' }
      ]
      
      for (const table of tables) {
        const items = await table.t.where('trip_id').equals(activeTripId).toArray()
        for (const item of items) {
          await table.t.delete(item.id)
          await db.outbox.add({
            id: newId(),
            table_name: table.name as any,
            op: 'DELETE',
            entity_id: item.id,
            payload: null,
            created_at: ts,
            try_count: 0,
            last_error: null,
          })
        }
      }
    })
    
    // Find next fallback trip
    const trips = await db.viajes.filter(t => t.deleted_at == null && t.id !== activeTripId).toArray()
    const fallbackId = trips.length > 0 ? trips[0].id : null
    
    setActiveTripId(fallbackId)
    
    setDeleteWarningOpen(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-zinc-900 bg-zinc-950 p-4 custom-scrollbar"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'config' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Configurar viaje</div>
                  <button className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900" onClick={onClose} type="button">
                    Cerrar
                  </button>
                </div>

            <div className="mb-4">
              <Field label="Nombre del Viaje">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-sky-400 placeholder-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Ej: Verano en Japón"
                />
              </Field>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-300">Tipo de Viaje</div>
              </div>
              <div className="flex rounded-xl bg-zinc-900 overflow-hidden border border-zinc-800 p-1">
                <button
                  type="button"
                  onClick={() => setLocalIsNational(false)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    !localIsNational ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🌍 Internacional
                </button>
                <button
                  type="button"
                  onClick={() => setLocalIsNational(true)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    localIsNational ? 'bg-emerald-900/40 text-emerald-400 shadow-md border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  📍 Nacional (COP)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicio">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  type="date"
                  value={localStartYmd}
                  onChange={(e) => setLocalStartYmd(e.target.value)}
                />
              </Field>
              <Field label="Fin">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  type="date"
                  value={localEndYmd}
                  onChange={(e) => setLocalEndYmd(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                {localIsNational ? 'Destinos (Ciudades)' : 'Países del viaje'}
              </div>
              <div className="flex flex-wrap gap-2">
                {localCountries.map((c) => (
                  <div key={c.code} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${editingCountryCode === c.code ? 'border-sky-500/50 bg-sky-500/10' : 'border-zinc-900 bg-zinc-950/40'}`}>
                    <div className="text-base leading-none">{c.flag}</div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-100">{c.name}</div>
                      <div className="text-[11px] text-zinc-400">{c.acronym} · {c.currency}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        className="rounded-xl px-2 py-1 text-[11px] font-medium text-sky-400 hover:bg-sky-500/10"
                        type="button"
                        onClick={() => editCountry(c)}
                      >
                        Editar
                      </button>
                      {localCountries.length > 1 ? (
                        <button
                          className="rounded-xl px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10"
                          type="button"
                          onClick={() => removeCountry(c.code)}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                <div className="text-xs font-semibold text-zinc-300 transition-colors">
                  {editingCountryCode ? (localIsNational ? 'Editando destino' : 'Editando país') : (localIsNational ? 'Agregar ciudad/destino' : 'Agregar país')}
                </div>
                <div className={`mt-2 grid ${localIsNational ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
                  <input
                    className={`${localIsNational ? 'col-span-1' : 'col-span-2'} w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30`}
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    placeholder={localIsNational ? 'Nombre de ciudad (ej: Medellín)' : 'Nombre (ej: Francia)'}
                  />
                  {!localIsNational && (
                    <input
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      value={newCountryFlag}
                      onChange={(e) => {
                        touchedRef.current.flag = true
                        setNewCountryFlag(e.target.value)
                      }}
                      placeholder="🇫🇷"
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className={`${localIsNational ? 'w-full' : 'w-24'} rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30`}
                    value={newCountryAcronym}
                    onChange={(e) => {
                      touchedRef.current.acronym = true
                      setNewCountryAcronym(e.target.value)
                    }}
                    placeholder={localIsNational ? 'Sigla (Opcional, ej: MED)' : 'FR'}
                  />
                  {!localIsNational && (
                    <input
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm transition-all focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      value={newCountryCurrency}
                      onChange={(e) => {
                        touchedRef.current.currency = true
                        setNewCountryCurrency(e.target.value)
                      }}
                      placeholder="Moneda (ej: EUR)"
                    />
                  )}
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  {editingCountryCode ? (
                    <button
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
                      type="button"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </button>
                  ) : null}
                  <button
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-all"
                    type="button"
                    onClick={saveCountry}
                    disabled={!newCountryName.trim() || (!localIsNational && !newCountryCurrency.trim())}
                  >
                    {editingCountryCode ? 'Guardar cambios' : 'Agregar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  {localIsNational ? 'Tramos (Destino por fechas)' : 'Tramos (país por fechas)'}
                </div>
                <button
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                  type="button"
                  onClick={openAddSeg}
                >
                  Agregar
                </button>
              </div>

              <div className="space-y-2">
                {localSegments.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-center text-sm text-zinc-400">Aún no has agregado tramos.</div>
                ) : null}

                {localSegments.map((seg, idx) => (
                  <div key={seg.id} className="group relative overflow-hidden rounded-2xl border border-zinc-900/80 bg-zinc-950/50 hover:bg-zinc-900/60 transition-colors">
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setEditingSegData({ mode: 'edit', seg })}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-xs font-bold text-zinc-500 group-hover:bg-sky-500/10 group-hover:text-sky-400 transition-colors">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                            <span className="truncate">{countryShort(localCountries, seg.fromStage)}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="truncate">{countryShort(localCountries, seg.toStage)}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-500">
                            {seg.startYmd.substring(5)} al {seg.endYmd.substring(5)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/20" 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); removeSeg(seg.id) }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={segmentsEndRef} className="h-1" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                {!isNew ? (
                  <button
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/10"
                    type="button"
                    onClick={() => setDeleteWarningOpen(true)}
                  >
                    Eliminar viaje
                  </button>
                ) : <div />}
                
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
                    type="button"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                    type="button"
                    onClick={onSave}
                  >
                    Guardar
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {deleteWarningOpen && !isNew ? (
                  <motion.div 
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div 
                      className="w-full max-w-sm rounded-3xl border border-rose-900/40 bg-zinc-950 p-6 shadow-2xl"
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    >
                      <div className="mb-3 text-xl font-bold text-rose-400">¿Eliminar este viaje?</div>
                      <div className="mb-6 text-sm text-zinc-400 leading-relaxed">
                        Se borrarán los datos asociados de tu dispositivo de forma irreversible y no podrás registrar más movimientos para este viaje.
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
                          onClick={() => setDeleteWarningOpen(false)}
                          type="button"
                        >
                          Mantener
                        </button>
                        <button
                          className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500 active:scale-95 transition-all"
                          onClick={handleDeleteTrip}
                          type="button"
                        >
                          Sí, eliminar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            </>
            ) : (
              <div className="flex flex-col h-full justify-center text-center py-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
                  <span className="text-3xl">🎉</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">¡Viaje creado con éxito!</h3>
                <p className="text-sm text-zinc-400 mb-6 px-4">
                  Antes de ir al calendario o registrar gastos, puedes definir un presupuesto global para tu viaje.
                </p>
                <div className="mb-8 px-4">
                  <label className="block text-left text-xs font-semibold uppercase tracking-wide text-zinc-300 mb-2">Presupuesto Global (COP)</label>
                  <input
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-lg font-bold text-sky-400 text-center focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="Ej: 3.500.000"
                    inputMode="numeric"
                    value={initialBudget}
                    onChange={(e) => setInitialBudget(e.target.value)}
                  />
                  <p className="text-xs text-zinc-500 mt-2 text-left">Puedes cambiarlo más tarde en la pestaña de Reportes.</p>
                </div>
                <div className="flex flex-col gap-2 px-4">
                  <button
                    className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 active:scale-[0.98] transition-transform"
                    onClick={() => void onSaveBudget()}
                    type="button"
                  >
                    Guardar presupuesto y continuar
                  </button>
                  <button
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 active:scale-[0.98] transition-transform"
                    onClick={() => { navigate('/gastos'); onClose(); }}
                    type="button"
                  >
                    Omitir por ahora
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}

      {editingSegData && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setEditingSegData(null)}
        >
          <motion.div
            className="flex w-full max-w-sm flex-col rounded-t-3xl border border-zinc-900 bg-zinc-950 p-5 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-white">
                {editingSegData.mode === 'add' ? 'Agregar tramo' : 'Editar tramo'}
              </div>
              <button 
                className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800" 
                onClick={() => setEditingSegData(null)}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-sky-900/30 bg-sky-500/5 p-3">
              <div className="mb-2 text-xs font-semibold text-sky-400">Origen</div>
              <div className="grid grid-cols-3 gap-2">
                {stageOptions.map((o) => {
                  const active = editingSegData.seg.fromStage === o.stage
                  return (
                    <button
                      key={o.stage}
                      type="button"
                      className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors ${active ? 'border-sky-500 bg-sky-500/20 text-sky-100 shadow-md shadow-sky-900/20' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'}`}
                      onClick={() => setEditingSegData({ ...editingSegData, seg: { ...editingSegData.seg, fromStage: o.stage as TripStage } })}
                    >
                      <div className="text-base leading-none">{o.flag}</div>
                      <div className="max-w-full truncate text-[10px] leading-none mt-1">{o.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-emerald-900/30 bg-emerald-500/5 p-3">
              <div className="mb-2 text-xs font-semibold text-emerald-400">Destino</div>
              <div className="grid grid-cols-3 gap-2">
                {stageOptions.map((o) => {
                  const active = editingSegData.seg.toStage === o.stage
                  return (
                    <button
                      key={o.stage}
                      type="button"
                      className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors ${active ? 'border-emerald-500 bg-emerald-500/20 text-emerald-100 shadow-md shadow-emerald-900/20' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'}`}
                      onClick={() => setEditingSegData({ ...editingSegData, seg: { ...editingSegData.seg, toStage: o.stage as TripStage } })}
                    >
                      <div className="text-base leading-none">{o.flag}</div>
                      <div className="max-w-full truncate text-[10px] leading-none mt-1">{o.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <Field label="Desde">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  type="date"
                  value={editingSegData.seg.startYmd}
                  onChange={(e) => setEditingSegData({ ...editingSegData, seg: { ...editingSegData.seg, startYmd: e.target.value } })}
                />
              </Field>
              <Field label="Hasta">
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  type="date"
                  value={editingSegData.seg.endYmd}
                  onChange={(e) => setEditingSegData({ ...editingSegData, seg: { ...editingSegData.seg, endYmd: e.target.value } })}
                />
              </Field>
            </div>

            <button
              className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-400 active:scale-[0.98] transition-transform"
              type="button"
              onClick={() => saveSeg(editingSegData.seg)}
            >
              Guardar tramo
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-300">{label}</div>
      {children}
    </label>
  )
}

function countryShort(countries: TripCountry[], code: string) {
  return countries.find((c) => c.code === code)?.acronym ?? code
}
