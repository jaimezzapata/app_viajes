import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CountryStage, CurrencyCode } from '@/../shared/types'
import { addDays, parseYmd, toYmd } from '@/utils/date'

export type TripStage = CountryStage

export type TripCountry = {
  code: string
  acronym: string
  name: string
  flag: string
  currency: CurrencyCode
}

export type TripSegment = {
  id: string
  fromStage: TripStage
  toStage: TripStage
  startYmd: string
  endYmd: string
}

export function stageForYmd(ymd: string, segments: TripSegment[], fallback: TripStage): TripStage {
  const match = segments.find((s) => s.startYmd <= ymd && ymd <= s.endYmd)
  return match?.toStage ?? fallback
}

import type { AppTrip } from '@/../shared/types'

type TripState = {
  activeTripId: string | null
  isNational: boolean
  tripStartYmd: string
  tripEndYmd: string
  segments: TripSegment[]
  countries: TripCountry[]
  selectedYmd: string
  stage: TripStage
  setActiveTripId: (id: string | null) => void
  loadTrip: (trip: AppTrip) => void
  setTripStartYmd: (ymd: string) => void
  setTripEndYmd: (ymd: string) => void
  setSegments: (segments: TripSegment[]) => void
  setCountries: (countries: TripCountry[]) => void
  setSelectedYmd: (ymd: string) => void
  setStage: (stage: TripStage) => void
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      activeTripId: null,
      isNational: false,
      tripStartYmd: toYmd(new Date()),
      tripEndYmd: toYmd(addDays(new Date(), 29)),
      segments: [],
      countries: [
        { code: 'COLOMBIA', acronym: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP' },
      ],
      selectedYmd: toYmd(new Date()),
      stage: 'COLOMBIA',
      setActiveTripId: (id) => set({ activeTripId: id }),
      loadTrip: (trip) =>
        set((s) => {
          let parsedCountries: TripCountry[] = []
          let parsedSegments: TripSegment[] = []
          try {
            parsedCountries = JSON.parse(trip.countries_json)
            parsedSegments = JSON.parse(trip.segments_json)
          } catch {}

          const stage = stageForYmd(s.selectedYmd, parsedSegments, parsedCountries[0]?.code ?? s.stage)
          return {
            activeTripId: trip.id,
            isNational: trip.is_national ?? false,
            tripStartYmd: trip.start_date,
            tripEndYmd: trip.end_date,
            countries: parsedCountries,
            segments: parsedSegments,
            stage,
          }
        }),
      setTripStartYmd: (ymd) =>
        set((s) => {
          const end = s.tripEndYmd < ymd ? ymd : s.tripEndYmd
          const selected = s.selectedYmd && s.selectedYmd < ymd ? ymd : s.selectedYmd
          return {
            tripStartYmd: ymd,
            tripEndYmd: end,
            selectedYmd: selected,
            stage: stageForYmd(selected, s.segments, s.stage),
          }
        }),
      setTripEndYmd: (ymd) =>
        set((s) => {
          const start = s.tripStartYmd > ymd ? ymd : s.tripStartYmd
          const selected = s.selectedYmd && s.selectedYmd > ymd ? ymd : s.selectedYmd
          return {
            tripStartYmd: start,
            tripEndYmd: ymd,
            selectedYmd: selected,
            stage: stageForYmd(selected, s.segments, s.stage),
          }
        }),
      setSegments: (segments) =>
        set((s) => ({
          segments,
          stage: stageForYmd(s.selectedYmd, segments, s.stage),
        })),
      setCountries: (countries) => set({ countries }),
      setSelectedYmd: (ymd) =>
        set((s) => {
          if (!ymd) return { selectedYmd: '' }
          const stage = stageForYmd(ymd, s.segments, s.stage)
          return { selectedYmd: ymd, stage }
        }),
      setStage: (stage) => set({ stage }),
    }),
    {
      name: 'app_viajes_trip',
      version: 2,
      migrate: (persisted) => {
        const s = persisted as any
        if (!s || typeof s !== 'object') return persisted as any
        const next = { ...s }
        if (Array.isArray(next.segments)) {
          next.segments = next.segments
            .map((seg: any) => {
              if (seg && typeof seg === 'object' && 'fromStage' in seg && 'toStage' in seg) return seg
              if (seg && typeof seg === 'object' && 'stage' in seg) {
                const st = String(seg.stage)
                return {
                  id: String(seg.id ?? `seg_${Math.random().toString(16).slice(2)}`),
                  fromStage: String(next.stage ?? st),
                  toStage: st,
                  startYmd: String(seg.startYmd ?? seg.startYmd ?? ''),
                  endYmd: String(seg.endYmd ?? seg.endYmd ?? ''),
                }
              }
              return seg
            })
            .filter(Boolean)
        }
        if (!next.activeTripId) {
          next.activeTripId = '00000000-0000-0000-0000-000000000001'
        }
        return next
      },
    },
  ),
)

export function clampYmd(ymd: string, minYmd: string, maxYmd: string) {
  if (ymd < minYmd) return minYmd
  if (ymd > maxYmd) return maxYmd
  return ymd
}

export function normalizeSegment(seg: TripSegment) {
  const start = parseYmd(seg.startYmd)
  const end = parseYmd(seg.endYmd)
  if (start <= end) return seg
  return { ...seg, startYmd: seg.endYmd, endYmd: seg.startYmd }
}
