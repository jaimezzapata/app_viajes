import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTripStore, type TripCountry, type TripSegment, type TripStage, clampYmd, normalizeSegment } from '@/stores/tripStore'
import { newId, nowIso } from '@/utils/id'
import { toYmd, addDays } from '@/utils/date'
import { db } from '@/db/appDb'

export default function TripConfigModal({ open, onClose, isNew }: { open: boolean; onClose: () => void; isNew?: boolean }) {
  const activeTripId = useTripStore((s) => s.activeTripId)
  const globalStartYmd = useTripStore((s) => s.tripStartYmd)
  const globalEndYmd = useTripStore((s) => s.tripEndYmd)
  const segments = useTripStore((s) => s.segments)
  const countries = useTripStore((s) => s.countries)
  const isNational = useTripStore((s) => s.isNational)
  const setActiveTripId = useTripStore((s) => s.setActiveTripId)

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

  const touchedRef = useRef({ acronym: false, currency: false, flag: false })
  const lastNameRef = useRef('')
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!open) return
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
    setDeleteWarningOpen(false)
  }, [open, isNew, activeTripId, countries, segments, globalStartYmd, globalEndYmd, isNational])

  const stageOptions = useMemo(
    () => localCountries.map((c) => ({ stage: c.code, label: c.name, flag: c.flag })),
    [localCountries],
  )

  function updateSeg(id: string, patch: Partial<TripSegment>) {
    setLocalSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function addSeg() {
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
    setLocalSegments((prev) => [...prev, seg])
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

    onClose()
  }

  async function handleDeleteTrip() {
    if (!activeTripId || isNew) return
    const ts = nowIso()
    const trip = await db.viajes.get(activeTripId)
    if (!trip) return
    
    // soft delete
    const nextTrip = { ...trip, deleted_at: ts, updated_at: ts }
    await db.viajes.put(nextTrip)
    await db.outbox.add({
      id: newId(),
      table_name: 'viajes',
      op: 'UPSERT',
      entity_id: activeTripId,
      payload: nextTrip,
      created_at: ts,
      try_count: 0,
      last_error: null,
    })
    
    // Find next fallback trip
    const trips = await db.viajes.filter(t => t.deleted_at == null && t.id !== activeTripId).toArray()
    const fallbackId = trips.length > 0 ? trips[0].id : null
    
    setActiveTripId(fallbackId)
    if (!fallbackId) {
      // Avoid null breaking the ui immediately
      useTripStore.getState().setActiveTripId('00000000-0000-0000-0000-000000000001')
    }
    
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
                  onClick={addSeg}
                >
                  Agregar
                </button>
              </div>

              <div className="space-y-2">
                {localSegments.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 text-center text-sm text-zinc-400">Aún no has agregado tramos.</div>
                ) : null}

                {localSegments.map((seg, idx) => (
                  <div key={seg.id} className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-zinc-300">Tramo {idx + 1} · {countryShort(localCountries, seg.fromStage)} → {countryShort(localCountries, seg.toStage)}</div>
                      <button className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900" type="button" onClick={() => removeSeg(seg.id)}>
                        Quitar
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {stageOptions.map((o) => {
                        const active = seg.fromStage === o.stage
                        return (
                          <button
                            key={o.stage}
                            type="button"
                            className={
                              'flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-xs transition-colors ' +
                              (active
                                ? 'border-sky-500 bg-sky-500/10 text-zinc-50'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900')
                            }
                            onClick={() => updateSeg(seg.id, { fromStage: o.stage as TripStage })}
                          >
                            <div className="text-base leading-none">{o.flag}</div>
                            <div className="max-w-full truncate leading-none">{o.label}</div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {stageOptions.map((o) => {
                        const active = seg.toStage === o.stage
                        return (
                          <button
                            key={o.stage}
                            type="button"
                            className={
                              'flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-xs transition-colors ' +
                              (active
                                ? 'border-emerald-500 bg-emerald-500/10 text-zinc-50'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900')
                            }
                            onClick={() => updateSeg(seg.id, { toStage: o.stage as TripStage })}
                          >
                            <div className="text-base leading-none">{o.flag}</div>
                            <div className="max-w-full truncate leading-none">{o.label}</div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Desde">
                        <input
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          type="date"
                          value={seg.startYmd}
                          onChange={(e) => updateSeg(seg.id, { startYmd: e.target.value })}
                        />
                      </Field>
                      <Field label="Hasta">
                        <input
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          type="date"
                          value={seg.endYmd}
                          onChange={(e) => updateSeg(seg.id, { endYmd: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
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

              {deleteWarningOpen && !isNew ? (
                <div className="mt-2 rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4">
                  <div className="text-sm font-bold text-rose-300 mb-1">¿Eliminar este viaje?</div>
                  <div className="text-xs text-rose-200/80 mb-4">
                    Se borrarán los datos asociados de tu dispositivo de forma irreversible y no podrás registrar más movimientos para este viaje.
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setDeleteWarningOpen(false)}
                      type="button"
                    >
                      Mantener
                    </button>
                    <button
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-900/20 hover:bg-rose-500 active:scale-95 transition-all"
                      onClick={handleDeleteTrip}
                      type="button"
                    >
                      Sí, eliminar viaje
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

          </motion.div>
        </motion.div>
      ) : null}
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
