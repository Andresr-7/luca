-- Luca · Endurecimiento de la base de datos (v2.2)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de schema.sql. Es idempotente: se puede correr de nuevo.
-- RLS ya garantiza que cada persona solo ve sus filas; esto añade defensa en profundidad contra abuso
-- (un cliente modificado que intente llenar la base, escribir colecciones inventadas o tocar su plan).

-- 1) Solo colecciones conocidas, ids cortos y documentos pequeños.
alter table public.docs drop constraint if exists docs_coleccion_valida;
alter table public.docs add constraint docs_coleccion_valida
  check (collection in ('tarjetas','gastos','pagos','ingresos','cuentas','movcuentas','metas','ajustes')) not valid;
alter table public.docs drop constraint if exists docs_id_corto;
alter table public.docs add constraint docs_id_corto check (char_length(id) between 1 and 64) not valid;
alter table public.docs drop constraint if exists docs_tamano;
alter table public.docs add constraint docs_tamano
  check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384) not valid;

-- 2) Límite de filas por persona (evita que una cuenta llene la base gratuita).
create or replace function public.docs_limite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.docs where user_id = new.user_id) >= 20000 then
    raise exception 'Límite de registros alcanzado' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists docs_limite on public.docs;
create trigger docs_limite before insert on public.docs for each row execute function public.docs_limite();

-- 3) La fecha de cambio la pone el servidor, no el cliente.
create or replace function public.docs_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_tocar on public.docs;
create trigger docs_tocar before insert or update on public.docs for each row execute function public.docs_tocar();

-- 4) Nadie puede cambiarse el plan ni el rol desde la app: solo el webhook (service_role).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- 5) El rol anónimo no toca datos.
revoke all on public.docs from anon;

-- 6) Las funciones internas no se pueden llamar desde la API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.docs_limite() from public, anon, authenticated;
revoke all on function public.docs_tocar() from public, anon, authenticated;

-- Comprobación rápida (debe devolver 0 filas): tablas públicas sin RLS.
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
