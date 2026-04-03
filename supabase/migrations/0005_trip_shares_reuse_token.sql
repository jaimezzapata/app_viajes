-- Reuse one active share token per trip (avoid creating a new link every time)

with ranked as (
  select
    token,
    trip_id,
    row_number() over (partition by trip_id order by created_at desc) as rn
  from public.trip_shares
  where revoked_at is null
)
update public.trip_shares ts
set revoked_at = now()
from ranked r
where ts.token = r.token
  and r.rn > 1;

create unique index if not exists trip_shares_one_active_per_trip
  on public.trip_shares(trip_id)
  where revoked_at is null;

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

