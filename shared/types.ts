export type UUID = string

export type CountryStage = string

export type CurrencyCode = string

export type CategoryKind = 'HOSPEDAJE' | 'TRANSPORTE' | 'COMIDA' | 'SOUVENIRES' | 'ENTRETENIMIENTO' | 'OTROS'

export type TransportSubkind =
  | 'VUELOS_INTERNACIONALES'
  | 'VUELOS_INTERNOS'
  | 'TRANSPORTE_INTERURBANO'
  | 'TRANSPORTE_URBANO'

export type SouvenirSubkind = 'ROPA' | 'DULCES_SNACKS' | 'TECNOLOGIA' | 'ARTESANIAS' | 'COMIDA' | 'HOGAR'

export type OtherSubkind = 'EQUIPAJE_EXTRA' | 'ENVIO_EQUIPAJE' | 'CANDADOS' | 'IMPREVISTOS'

export type EntertainmentSubkind = 'GENERAL' | 'MUSEO' | 'TOUR' | 'EVENTO' | 'RESTAURANTE'

export type CategorySubkind = TransportSubkind | SouvenirSubkind | OtherSubkind | EntertainmentSubkind

export type AppCategory = {
  id: UUID
  user_id: UUID | null
  kind: CategoryKind
  subkind: CategorySubkind | null
  name: string
  color: string
  icon: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AppExpense = {
  id: UUID
  user_id: UUID | null
  trip_id: UUID
  date: string
  stage: CountryStage
  category_id: UUID
  description: string
  currency: CurrencyCode
  amount_original: number
  fx_rate_to_cop: number
  amount_cop: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ItineraryType = 'VUELO' | 'TREN' | 'BUS' | 'METRO' | 'A_PIE' | 'OTRO'

export type AppItinerary = {
  id: UUID
  user_id: UUID | null
  trip_id: UUID
  date: string
  start_time: string | null
  end_time: string | null
  stage: CountryStage
  type: ItineraryType
  title: string
  from_place: string | null
  to_place: string | null
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AppLodging = {
  id: UUID
  user_id: UUID | null
  trip_id: UUID
  stage: CountryStage
  name: string
  city: string
  check_in: string
  check_out: string
  address: string
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AppBudget = {
  id: UUID
  user_id: UUID | null
  trip_id: UUID
  stage: CountryStage
  category_id: UUID | null
  amount_cop: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ActivityType = 'MUSEO' | 'RESTAURANTE' | 'TOUR' | 'EVENTO' | 'COMPRAS' | 'OTRO'

export type AppActivity = {
  id: UUID
  user_id: UUID | null
  trip_id: UUID
  stage: CountryStage
  date: string
  start_time: string | null
  end_time: string | null
  type: ActivityType
  title: string
  location: string | null
  booking_refs: string | null
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TripCountryConfig = {
  code: string
  acronym: string
  name: string
  flag: string
  currency: CurrencyCode
}

export type AppTrip = {
  id: UUID
  user_id: UUID | null
  name: string
  start_date: string
  end_date: string
  countries_json: string 
  segments_json: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type OutboxOp = 'UPSERT' | 'DELETE'

export type OutboxItem = {
  id: UUID
  table_name: 'categorias' | 'gastos' | 'itinerarios' | 'hospedajes' | 'presupuestos' | 'viajes' | 'actividades'
  op: OutboxOp
  entity_id: UUID
  payload: unknown
  created_at: string
  try_count: number
  last_error: string | null
}

export type SyncState = {
  key: string
  value: string
}

export type MetaKV = {
  key: string
  value: string
}
