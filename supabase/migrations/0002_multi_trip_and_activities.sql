-- Migración 0002: Multi-viaje y Actividades

-- 1. Crear tabla de Viajes (Trips)
CREATE TABLE public.viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  countries_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  segments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 2. Crear tabla de Actividades
CREATE TABLE public.actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  trip_id uuid REFERENCES public.viajes(id) ON DELETE CASCADE,
  stage text NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  type text NOT NULL,
  title text NOT NULL,
  location text,
  booking_refs text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 3. Añadir columna trip_id a las tablas existentes (permitiendo temporalmente valores nulos)
ALTER TABLE public.gastos ADD COLUMN trip_id uuid REFERENCES public.viajes(id) ON DELETE CASCADE;
ALTER TABLE public.itinerarios ADD COLUMN trip_id uuid REFERENCES public.viajes(id) ON DELETE CASCADE;
ALTER TABLE public.hospedajes ADD COLUMN trip_id uuid REFERENCES public.viajes(id) ON DELETE CASCADE;
ALTER TABLE public.presupuestos ADD COLUMN trip_id uuid REFERENCES public.viajes(id) ON DELETE CASCADE;

-- 4. Inserción del Viaje Predeterminado (Para mantener datos huérfanos del "MVP")
-- Crearemos temporalmente un viaje con ID fijo que agrupará la información existente.
DO $$
DECLARE
  default_trip_id uuid := '00000000-0000-0000-0000-000000000001';
  has_data boolean := false;
BEGIN
  -- Verificar si hay información preexistente para no crear el viaje en vano si está vacía
  IF EXISTS (SELECT 1 FROM public.gastos) OR EXISTS (SELECT 1 FROM public.itinerarios) THEN
    has_data := true;
  END IF;

  IF has_data THEN
    INSERT INTO public.viajes (id, user_id, name, start_date, end_date, countries_json, segments_json)
    VALUES (
      default_trip_id,
      NULL,
      'Mi Primer Viaje',
      current_date,
      current_date + interval '30 days',
      '[{"code": "COLOMBIA", "acronym": "CO", "name": "Colombia", "flag": "🇨🇴", "currency": "COP"}, {"code": "ESPANA", "acronym": "ES", "name": "España", "flag": "🇪🇸", "currency": "EUR"}, {"code": "JAPON", "acronym": "JP", "name": "Japón", "flag": "🇯🇵", "currency": "JPY"}]'::jsonb,
      '[]'::jsonb
    );

    UPDATE public.gastos SET trip_id = default_trip_id WHERE trip_id IS NULL;
    UPDATE public.itinerarios SET trip_id = default_trip_id WHERE trip_id IS NULL;
    UPDATE public.hospedajes SET trip_id = default_trip_id WHERE trip_id IS NULL;
    UPDATE public.presupuestos SET trip_id = default_trip_id WHERE trip_id IS NULL;
  END IF;
END $$;

-- Si después de asegurar los datos (o si no los hay) queremos estrictamente forzar NOT NULL, 
-- debemos tener cuidado con nuevas inserciones en bases vacías. En PWA Offline-first, 
-- a veces temporalmente se manda sin trip_id al principio si no ha sincronizado el UUID.
-- Mantenemos NOT NULL en backend para forzar estructura:
-- Solo hacer NOT NULL si garantizamos que no existen filas sueltas null, pero en SQLite/Dexie se mandará bien.
-- (Se deja flexible dependiendo de la lógica de hidratación del appDb, por ahora lo forzamos).

DO $$ 
BEGIN
  -- Evitar la caída si hay filas huérfanas omitidas
  UPDATE public.gastos SET trip_id = '00000000-0000-0000-0000-000000000001' WHERE trip_id IS NULL AND EXISTS (SELECT 1 FROM public.viajes WHERE id = '00000000-0000-0000-0000-000000000001');
  -- Si el insert falló por no haber datos previos, alter table NOT NULL fallaría en nuevas inserts? No, porque la PWA las generará correctas.
END $$;

-- Podríamos forzar constraint, pero SQLite/Outbox es a veces perezoso, lo posponemos o lo mantenemos en nivel API.
-- Por seguridad y coherencia DB, hagámoslo NOT NULL.
-- Nota: En un entorno real se asumen DB limpias o migración perfecta, aquí podemos dejarlo sin NOT NULL como soft check o forzarlo:
-- ALTER TABLE public.gastos ALTER COLUMN trip_id SET NOT NULL;
-- (Lo omitimos como regla dura de DB en este script solo por seguridad de sincronización PWA, recayendo en la validación local).

-- 5. Creación de índices
CREATE INDEX viajes_user_id_idx ON public.viajes (user_id);
CREATE INDEX actividades_user_id_idx ON public.actividades (user_id);
CREATE INDEX actividades_trip_id_idx ON public.actividades (trip_id);
CREATE INDEX actividades_date_idx ON public.actividades (date);
CREATE INDEX actividades_stage_idx ON public.actividades (stage);

CREATE INDEX gastos_trip_id_idx ON public.gastos (trip_id);
CREATE INDEX itinerarios_trip_id_idx ON public.itinerarios (trip_id);
CREATE INDEX hospedajes_trip_id_idx ON public.hospedajes (trip_id);
CREATE INDEX presupuestos_trip_id_idx ON public.presupuestos (trip_id);

-- 6. Insertar la Categoría ENTRETENIMIENTO a la tabla
INSERT INTO public.categorias (id, user_id, kind, subkind, name, color, icon)
VALUES
  ('a1b2c3d4-b4a1-4012-8e1a-5f6b7c8d9e0b', NULL, 'ENTRETENIMIENTO', 'GENERAL', 'Entretenimiento/Actividades', '#ec4899', 'Ticket')
ON CONFLICT (id) DO NOTHING;

-- 7. RLS Políticas
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_all_viajes ON public.viajes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_viajes ON public.viajes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all_actividades ON public.actividades FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_actividades ON public.actividades FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viajes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actividades TO anon;
GRANT ALL PRIVILEGES ON public.viajes TO authenticated;
GRANT ALL PRIVILEGES ON public.actividades TO authenticated;
