-- Public share links for read-only trip viewing

create table if not exists public.trip_shares (
  token uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.viajes(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.trip_shares enable row level security;

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

  insert into public.trip_shares(trip_id) values (p_trip_id)
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function public.create_trip_share(uuid) to authenticated;

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

grant execute on function public.revoke_trip_share(uuid) to authenticated;

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

grant execute on function public.get_shared_trip(uuid) to anon;
grant execute on function public.get_shared_trip(uuid) to authenticated;

