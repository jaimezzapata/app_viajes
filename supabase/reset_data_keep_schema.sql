begin;

delete from public.actividades;
delete from public.presupuestos;
delete from public.hospedajes;
delete from public.itinerarios;
delete from public.gastos;
delete from public.viajes;

delete from public.categorias where user_id is not null;
update public.categorias set deleted_at = null, updated_at = now() where user_id is null and deleted_at is not null;

commit;

