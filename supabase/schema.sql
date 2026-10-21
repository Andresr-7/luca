-- =====================================================================
-- Luca — base de datos (Supabase / PostgreSQL)
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin dañar nada.
-- =====================================================================

-- 1) Registros de la app -------------------------------------------------
-- Una fila por registro (una tarjeta, un gasto, un pago…). "collection" dice qué es
-- y "data" guarda sus campos. Cada fila pertenece a un usuario.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  collection text        not null check (collection in
               ('tarjetas','gastos','pagos','ingresos','metas','cuentas','movcuentas','ajustes')),
  id         text        not null check (char_length(id) between 1 and 100),
  data       jsonb       not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);
create index if not exists docs_user_collection_idx on public.docs (user_id, collection);

-- Seguridad: cada persona solo ve y cambia SUS filas.
alter table public.docs enable row level security;
drop policy if exists "docs: ver las mías"      on public.docs;
drop policy if exists "docs: crear las mías"    on public.docs;
drop policy if exists "docs: cambiar las mías"  on public.docs;
drop policy if exists "docs: borrar las mías"   on public.docs;
create policy "docs: ver las mías"     on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "docs: crear las mías"   on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "docs: cambiar las mías" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "docs: borrar las mías"  on public.docs for delete to authenticated using ((select auth.uid()) = user_id);

-- Sincronización en vivo entre celular y computador.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 2) Perfil y plan (para cobrar en el futuro) ------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  created_at          timestamptz not null default now(),
  plan                text not null default 'free' check (plan in ('free','pro')),
  plan_until          timestamptz,          -- null = sin fecha de vencimiento
  payment_provider    text,                 -- ej. 'wompi', 'mercadopago', 'apple', 'google'
  payment_customer_id text
);
alter table public.profiles enable row level security;
drop policy if exists "perfil: ver el mío" on public.profiles;
create policy "perfil: ver el mío" on public.profiles for select to authenticated using ((select auth.uid()) = id);
-- A propósito NO hay política de update: el plan solo lo cambia el servidor (webhook de pagos),
-- nunca la app, así nadie puede volverse "Pro" sin pagar.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que ya existían antes de correr este archivo.
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

-- 3) Eliminar mi cuenta (lo exigen Apple y Google en apps con registro) ----
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();   -- borra en cascada docs y profiles
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 4) Vistas para análisis (Power BI, Looker Studio, SQL) -------------------
-- Convierten el JSON en columnas normales. Respetan la seguridad de cada usuario.
create or replace view public.v_gastos with (security_invoker = true) as
select user_id, id,
       nullif(data->>'fecha','')::date      as fecha,
       (data->>'valor')::numeric            as valor_cop,
       (data->>'valorUsd')::numeric         as valor_usd,
       data->>'categoria'                   as categoria,
       data->>'medio'                       as medio,
       data->>'nota'                        as nota,
       data->>'tarjetaId'                   as tarjeta_id,
       data->>'cuentaId'                    as cuenta_id
from public.docs where collection = 'gastos';

create or replace view public.v_ingresos with (security_invoker = true) as
select user_id, id, nullif(data->>'fecha','')::date as fecha, (data->>'valor')::numeric as valor_cop,
       data->>'nota' as nota, data->>'cuentaId' as cuenta_id
from public.docs where collection = 'ingresos';

create or replace view public.v_pagos_tarjetas with (security_invoker = true) as
select user_id, id, nullif(data->>'fecha','')::date as fecha, (data->>'valor')::numeric as valor_cop,
       (data->>'valorUsd')::numeric as valor_usd, data->>'tarjeta' as tarjeta, data->>'tarjetaId' as tarjeta_id,
       data->>'cuentaId' as cuenta_id
from public.docs where collection = 'pagos';

create or replace view public.v_tarjetas with (security_invoker = true) as
select user_id, id, data->>'nombre' as nombre,
       (data->>'saldo')::numeric as deuda_cop, (data->>'minimo')::numeric as minimo_cop,
       coalesce((data->>'usd')::boolean,false) as tiene_usd,
       (data->>'saldoUsd')::numeric as deuda_usd, (data->>'minimoUsd')::numeric as minimo_usd,
       (data->>'cupo')::numeric as cupo, (data->>'dia')::int as dia_pago, (data->>'corte')::int as dia_corte
from public.docs where collection = 'tarjetas';

create or replace view public.v_cuentas with (security_invoker = true) as
select user_id, id, data->>'nombre' as nombre, (data->>'saldo')::numeric as saldo_cop
from public.docs where collection = 'cuentas';

create or replace view public.v_movimientos_cuentas with (security_invoker = true) as
select user_id, id, nullif(data->>'fecha','')::date as fecha, data->>'cuentaId' as cuenta_id, data->>'cuenta' as cuenta,
       data->>'tipo' as tipo, (data->>'valor')::numeric as valor_cop, data->>'nota' as nota
from public.docs where collection = 'movcuentas';

-- Rol especial (por ejemplo 'desarrollador'): solo se cambia desde el panel de Supabase.
alter table public.profiles add column if not exists rol text;
