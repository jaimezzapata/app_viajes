begin;

create extension if not exists pgcrypto;

drop function if exists public.get_shared_trip(uuid);
drop function if exists public.revoke_trip_share(uuid);
drop function if exists public.create_trip_share(uuid);
drop function if exists public.set_user_id();

drop table if exists public.trip_shares cascade;
drop table if exists public.actividades cascade;
drop table if exists public.presupuestos cascade;
drop table if exists public.hospedajes cascade;
drop table if exists public.itinerarios cascade;
drop table if exists public.gastos cascade;
drop table if exists public.categorias cascade;
drop table if exists public.viajes cascade;

create table public.viajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_national boolean not null default false,
  countries_json jsonb not null default '[]'::jsonb,
  segments_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.categorias (
  id uuid primary key,
  user_id uuid,
  kind text not null,
  subkind text,
  name text not null,
  color text not null,
  icon text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  trip_id uuid references public.viajes(id) on delete cascade,
  date date not null,
  stage text not null,
  category_id uuid not null,
  description text not null default '',
  currency text not null,
  amount_original numeric not null,
  fx_rate_to_cop numeric not null,
  amount_cop numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.itinerarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  trip_id uuid references public.viajes(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  stage text not null,
  type text not null,
  title text not null,
  from_place text,
  to_place text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.hospedajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  trip_id uuid references public.viajes(id) on delete cascade,
  stage text not null,
  name text not null,
  city text not null,
  check_in date not null,
  check_out date not null,
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  trip_id uuid references public.viajes(id) on delete cascade,
  stage text not null,
  category_id uuid,
  amount_cop numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  trip_id uuid references public.viajes(id) on delete cascade,
  stage text not null,
  date date not null,
  start_time time,
  end_time time,
  type text not null,
  title text not null,
  location text,
  booking_refs text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trip_shares (
  token uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.viajes(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index viajes_user_id_idx on public.viajes (user_id);

create index gastos_user_id_idx on public.gastos (user_id);
create index gastos_trip_id_idx on public.gastos (trip_id);
create index gastos_date_idx on public.gastos (date);
create index gastos_stage_idx on public.gastos (stage);
create index gastos_category_idx on public.gastos (category_id);

create index itinerarios_user_id_idx on public.itinerarios (user_id);
create index itinerarios_trip_id_idx on public.itinerarios (trip_id);
create index itinerarios_date_idx on public.itinerarios (date);
create index itinerarios_stage_idx on public.itinerarios (stage);

create index hospedajes_user_id_idx on public.hospedajes (user_id);
create index hospedajes_trip_id_idx on public.hospedajes (trip_id);
create index hospedajes_stage_idx on public.hospedajes (stage);
create index hospedajes_check_in_idx on public.hospedajes (check_in);

create index presupuestos_user_id_idx on public.presupuestos (user_id);
create index presupuestos_trip_id_idx on public.presupuestos (trip_id);
create index presupuestos_stage_idx on public.presupuestos (stage);
create index presupuestos_category_idx on public.presupuestos (category_id);

create index actividades_user_id_idx on public.actividades (user_id);
create index actividades_trip_id_idx on public.actividades (trip_id);
create index actividades_date_idx on public.actividades (date);
create index actividades_stage_idx on public.actividades (stage);

create unique index trip_shares_one_active_per_trip
  on public.trip_shares(trip_id)
  where revoked_at is null;

alter table public.viajes enable row level security;
alter table public.categorias enable row level security;
alter table public.gastos enable row level security;
alter table public.itinerarios enable row level security;
alter table public.hospedajes enable row level security;
alter table public.presupuestos enable row level security;
alter table public.actividades enable row level security;
alter table public.trip_shares enable row level security;

create policy auth_viajes on public.viajes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_gastos on public.gastos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_itinerarios on public.itinerarios
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_hospedajes on public.hospedajes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_presupuestos on public.presupuestos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_actividades on public.actividades
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_read_categorias on public.categorias
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);

create policy auth_write_categorias on public.categorias
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_trip_shares_read_own on public.trip_shares
  for select to authenticated
  using (
    exists (
      select 1
      from public.viajes v
      where v.id = trip_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    )
  );

create policy auth_trip_shares_write_own on public.trip_shares
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.viajes v
      where v.id = trip_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    )
  );

create policy auth_trip_shares_update_own on public.trip_shares
  for update to authenticated
  using (
    exists (
      select 1
      from public.viajes v
      where v.id = trip_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.viajes v
      where v.id = trip_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    )
  );

create or replace function public.set_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_user_id_viajes on public.viajes;
create trigger set_user_id_viajes
before insert on public.viajes
for each row execute function public.set_user_id();

drop trigger if exists set_user_id_gastos on public.gastos;
create trigger set_user_id_gastos
before insert on public.gastos
for each row execute function public.set_user_id();

drop trigger if exists set_user_id_itinerarios on public.itinerarios;
create trigger set_user_id_itinerarios
before insert on public.itinerarios
for each row execute function public.set_user_id();

drop trigger if exists set_user_id_hospedajes on public.hospedajes;
create trigger set_user_id_hospedajes
before insert on public.hospedajes
for each row execute function public.set_user_id();

drop trigger if exists set_user_id_presupuestos on public.presupuestos;
create trigger set_user_id_presupuestos
before insert on public.presupuestos
for each row execute function public.set_user_id();

drop trigger if exists set_user_id_actividades on public.actividades;
create trigger set_user_id_actividades
before insert on public.actividades
for each row execute function public.set_user_id();

create or replace function public.create_trip_share(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.viajes v
    where v.id = p_trip_id
      and v.user_id = auth.uid()
      and v.deleted_at is null
  ) then
    raise exception 'not_allowed';
  end if;

  select ts.token into v_token
  from public.trip_shares ts
  where ts.trip_id = p_trip_id
    and ts.revoked_at is null
  order by ts.created_at desc
  limit 1;

  if v_token is not null then
    return v_token;
  end if;

  insert into public.trip_shares(trip_id) values (p_trip_id)
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.revoke_trip_share(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.trip_shares ts
  set revoked_at = now()
  where ts.token = p_token
    and exists (
      select 1 from public.viajes v
      where v.id = ts.trip_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    );
end;
$$;

create or replace function public.get_shared_trip(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  result jsonb;
begin
  select ts.trip_id into v_trip_id
  from public.trip_shares ts
  where ts.token = p_token
    and ts.revoked_at is null;

  if v_trip_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'trip', (select to_jsonb(v) from public.viajes v where v.id = v_trip_id and v.deleted_at is null),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.categorias c where (c.user_id is null or c.user_id = (select user_id from public.viajes v2 where v2.id = v_trip_id)) and c.deleted_at is null),
    'gastos', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.gastos g where g.trip_id = v_trip_id and g.deleted_at is null),
    'itinerarios', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.itinerarios i where i.trip_id = v_trip_id and i.deleted_at is null),
    'hospedajes', (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from public.hospedajes h where h.trip_id = v_trip_id and h.deleted_at is null),
    'actividades', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.actividades a where a.trip_id = v_trip_id and a.deleted_at is null),
    'presupuestos', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.presupuestos p where p.trip_id = v_trip_id and p.deleted_at is null)
  ) into result;

  return result;
end;
$$;

revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant select, insert, update, delete on public.viajes to authenticated;
grant select, insert, update, delete on public.categorias to authenticated;
grant select, insert, update, delete on public.gastos to authenticated;
grant select, insert, update, delete on public.itinerarios to authenticated;
grant select, insert, update, delete on public.hospedajes to authenticated;
grant select, insert, update, delete on public.presupuestos to authenticated;
grant select, insert, update, delete on public.actividades to authenticated;
grant select, insert, update on public.trip_shares to authenticated;

grant execute on function public.create_trip_share(uuid) to authenticated;
grant execute on function public.revoke_trip_share(uuid) to authenticated;
grant execute on function public.get_shared_trip(uuid) to anon;
grant execute on function public.get_shared_trip(uuid) to authenticated;

insert into public.categorias (id, user_id, kind, subkind, name, color, icon)
values
  ('c7f3c1b6-3c03-4f25-9af6-9b8e26a8f9d1', null, 'HOSPEDAJE', null, 'Hospedaje', '#0ea5e9', 'Hotel'),
  ('f7d9a1d4-1b60-4b68-9a0b-3d4f0d0ee27f', null, 'TRANSPORTE', 'VUELOS_INTERNACIONALES', 'Vuelos internacionales', '#a855f7', 'Plane'),
  ('9bd8c0e9-7b46-4f3d-bf5c-d9383f6253e8', null, 'TRANSPORTE', 'VUELOS_INTERNOS', 'Vuelos internos', '#a855f7', 'PlaneTakeoff'),
  ('2c3f2a10-2d0a-4a62-9a76-5bda0f8c9c31', null, 'TRANSPORTE', 'TRANSPORTE_INTERURBANO', 'Transporte interurbano', '#a855f7', 'Train'),
  ('0c2b9f4e-14c1-4c1c-8b2a-ecf1a0f2b17c', null, 'TRANSPORTE', 'TRANSPORTE_URBANO', 'Transporte urbano', '#a855f7', 'Bus'),
  ('3b0b2d6f-9a9a-4f0a-a7d6-7d6c0a2b8a40', null, 'COMIDA', null, 'Comida', '#22c55e', 'Utensils'),
  ('b0a2d57e-7e4c-4c2f-8c0e-2a2f2f8e3b31', null, 'SOUVENIRES', 'ROPA', 'Souvenires — Ropa', '#f59e0b', 'Shirt'),
  ('e3b1c7a4-2f6d-4b0d-9ac2-7e8b4d1c5a9f', null, 'SOUVENIRES', 'DULCES_SNACKS', 'Souvenires — Dulces/Snacks', '#f59e0b', 'Candy'),
  ('4f2d9c18-7b6a-4e31-9c0e-1a2b3c4d5e6f', null, 'SOUVENIRES', 'TECNOLOGIA', 'Souvenires — Tecnología', '#f59e0b', 'Smartphone'),
  ('2a9d4c1e-0b7c-4e8c-9f10-6b5a4d3c2b1a', null, 'SOUVENIRES', 'ARTESANIAS', 'Souvenires — Artesanías', '#f59e0b', 'Gift'),
  ('7c1e2d3a-9b5f-4c2d-8e1a-5f6b7c8d9e0a', null, 'SOUVENIRES', 'COMIDA', 'Souvenires — Comida', '#f59e0b', 'ShoppingBag'),
  ('1b2c3d4e-5a6f-4b3c-9d8e-0a1b2c3d4e5a', null, 'SOUVENIRES', 'HOGAR', 'Souvenires — Hogar', '#f59e0b', 'Home'),
  ('a1b2c3d4-b4a1-4012-8e1a-5f6b7c8d9e0b', null, 'ENTRETENIMIENTO', 'GENERAL', 'Entretenimiento/Actividades', '#ec4899', 'Ticket'),
  ('5b6c7d8e-9f10-4a1b-8c2d-3e4f5a6b7c8d', null, 'OTROS', 'EQUIPAJE_EXTRA', 'Otros — Equipaje extra', '#f43f5e', 'Luggage'),
  ('8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a', null, 'OTROS', 'ENVIO_EQUIPAJE', 'Otros — Envío de equipaje', '#f43f5e', 'Package'),
  ('0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f', null, 'OTROS', 'CANDADOS', 'Otros — Candados', '#f43f5e', 'Lock'),
  ('9f8e7d6c-5b4a-4a3b-2c1d-0e9f8e7d6c5b', null, 'OTROS', 'IMPREVISTOS', 'Otros — Imprevistos', '#f43f5e', 'TriangleAlert')
on conflict (id) do nothing;

commit;

