DROP TABLE IF EXISTS public.presupuestos CASCADE;
DROP TABLE IF EXISTS public.hospedajes CASCADE;
DROP TABLE IF EXISTS public.itinerarios CASCADE;
DROP TABLE IF EXISTS public.gastos CASCADE;
DROP TABLE IF EXISTS public.categorias CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.categorias (
  id uuid PRIMARY KEY,
  user_id uuid,
  kind text NOT NULL,
  subkind text,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL,
  stage text NOT NULL,
  category_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  currency text NOT NULL,
  amount_original numeric NOT NULL,
  fx_rate_to_cop numeric NOT NULL,
  amount_cop numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.itinerarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL,
  start_time time,
  end_time time,
  stage text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  from_place text,
  to_place text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.hospedajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  stage text NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  stage text NOT NULL,
  category_id uuid,
  amount_cop numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX gastos_user_id_idx ON public.gastos (user_id);
CREATE INDEX gastos_date_idx ON public.gastos (date);
CREATE INDEX gastos_stage_idx ON public.gastos (stage);
CREATE INDEX gastos_category_idx ON public.gastos (category_id);

CREATE INDEX itinerarios_user_id_idx ON public.itinerarios (user_id);
CREATE INDEX itinerarios_date_idx ON public.itinerarios (date);
CREATE INDEX itinerarios_stage_idx ON public.itinerarios (stage);

CREATE INDEX hospedajes_user_id_idx ON public.hospedajes (user_id);
CREATE INDEX hospedajes_stage_idx ON public.hospedajes (stage);
CREATE INDEX hospedajes_check_in_idx ON public.hospedajes (check_in);

CREATE INDEX presupuestos_user_id_idx ON public.presupuestos (user_id);
CREATE INDEX presupuestos_stage_idx ON public.presupuestos (stage);
CREATE INDEX presupuestos_category_idx ON public.presupuestos (category_id);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospedajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all_categorias ON public.categorias;
DROP POLICY IF EXISTS auth_all_categorias ON public.categorias;
DROP POLICY IF EXISTS anon_all_gastos ON public.gastos;
DROP POLICY IF EXISTS auth_all_gastos ON public.gastos;
DROP POLICY IF EXISTS anon_all_itinerarios ON public.itinerarios;
DROP POLICY IF EXISTS auth_all_itinerarios ON public.itinerarios;
DROP POLICY IF EXISTS anon_all_hospedajes ON public.hospedajes;
DROP POLICY IF EXISTS auth_all_hospedajes ON public.hospedajes;
DROP POLICY IF EXISTS anon_all_presupuestos ON public.presupuestos;
DROP POLICY IF EXISTS auth_all_presupuestos ON public.presupuestos;

CREATE POLICY anon_all_categorias ON public.categorias FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_categorias ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_gastos ON public.gastos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_gastos ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_itinerarios ON public.itinerarios FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_itinerarios ON public.itinerarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_hospedajes ON public.hospedajes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_hospedajes ON public.hospedajes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anon_all_presupuestos ON public.presupuestos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_presupuestos ON public.presupuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospedajes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuestos TO anon;

GRANT ALL PRIVILEGES ON public.categorias TO authenticated;
GRANT ALL PRIVILEGES ON public.gastos TO authenticated;
GRANT ALL PRIVILEGES ON public.itinerarios TO authenticated;
GRANT ALL PRIVILEGES ON public.hospedajes TO authenticated;
GRANT ALL PRIVILEGES ON public.presupuestos TO authenticated;

INSERT INTO public.categorias (id, user_id, kind, subkind, name, color, icon)
VALUES
  ('c7f3c1b6-3c03-4f25-9af6-9b8e26a8f9d1', NULL, 'HOSPEDAJE', NULL, 'Hospedaje', '#0ea5e9', 'Hotel'),

  ('f7d9a1d4-1b60-4b68-9a0b-3d4f0d0ee27f', NULL, 'TRANSPORTE', 'VUELOS_INTERNACIONALES', 'Vuelos internacionales', '#a855f7', 'Plane'),
  ('9bd8c0e9-7b46-4f3d-bf5c-d9383f6253e8', NULL, 'TRANSPORTE', 'VUELOS_INTERNOS', 'Vuelos internos', '#a855f7', 'PlaneTakeoff'),
  ('2c3f2a10-2d0a-4a62-9a76-5bda0f8c9c31', NULL, 'TRANSPORTE', 'TRANSPORTE_INTERURBANO', 'Transporte interurbano', '#a855f7', 'Train'),
  ('0c2b9f4e-14c1-4c1c-8b2a-ecf1a0f2b17c', NULL, 'TRANSPORTE', 'TRANSPORTE_URBANO', 'Transporte urbano', '#a855f7', 'Bus'),

  ('3b0b2d6f-9a9a-4f0a-a7d6-7d6c0a2b8a40', NULL, 'COMIDA', NULL, 'Comida', '#22c55e', 'Utensils'),

  ('b0a2d57e-7e4c-4c2f-8c0e-2a2f2f8e3b31', NULL, 'SOUVENIRES', 'ROPA', 'Souvenires — Ropa', '#f59e0b', 'Shirt'),
  ('e3b1c7a4-2f6d-4b0d-9ac2-7e8b4d1c5a9f', NULL, 'SOUVENIRES', 'DULCES_SNACKS', 'Souvenires — Dulces/Snacks', '#f59e0b', 'Candy'),
  ('4f2d9c18-7b6a-4e31-9c0e-1a2b3c4d5e6f', NULL, 'SOUVENIRES', 'TECNOLOGIA', 'Souvenires — Tecnología', '#f59e0b', 'Smartphone'),
  ('2a9d4c1e-0b7c-4e8c-9f10-6b5a4d3c2b1a', NULL, 'SOUVENIRES', 'ARTESANIAS', 'Souvenires — Artesanías', '#f59e0b', 'Gift'),
  ('7c1e2d3a-9b5f-4c2d-8e1a-5f6b7c8d9e0a', NULL, 'SOUVENIRES', 'COMIDA', 'Souvenires — Comida', '#f59e0b', 'ShoppingBag'),
  ('1b2c3d4e-5a6f-4b3c-9d8e-0a1b2c3d4e5a', NULL, 'SOUVENIRES', 'HOGAR', 'Souvenires — Hogar', '#f59e0b', 'Home'),

  ('5b6c7d8e-9f10-4a1b-8c2d-3e4f5a6b7c8d', NULL, 'OTROS', 'EQUIPAJE_EXTRA', 'Otros — Equipaje extra', '#f43f5e', 'Luggage'),
  ('8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a', NULL, 'OTROS', 'ENVIO_EQUIPAJE', 'Otros — Envío de equipaje', '#f43f5e', 'Package'),
  ('0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f', NULL, 'OTROS', 'CANDADOS', 'Otros — Candados', '#f43f5e', 'Lock'),
  ('9f8e7d6c-5b4a-4a3b-2c1d-0e9f8e7d6c5b', NULL, 'OTROS', 'IMPREVISTOS', 'Otros — Imprevistos', '#f43f5e', 'TriangleAlert');

