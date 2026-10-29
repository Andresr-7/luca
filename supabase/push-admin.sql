-- Luca · Notificaciones push + panel de desarrollador
-- Ejecutar UNA vez en Supabase → SQL Editor. Es idempotente.

-- 1) Suscripciones push (una por celular)
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push: mías" on public.push_subs;
create policy "push: mías" on public.push_subs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.push_subs from anon;

-- 2) Historial de envíos
create table if not exists public.push_envios (
  id bigint generated always as identity primary key,
  titulo text, cuerpo text, publico text, enviados int, fallidos int,
  creado timestamptz default now()
);
alter table public.push_envios enable row level security; -- sin políticas: solo service_role y funciones

-- 3) ¿El que llama es desarrollador?
create or replace function public.es_dev() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and rol = 'desarrollador')
$$;

-- 4) Resumen para el panel
create or replace function public.admin_resumen() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  return json_build_object(
    'usuarios', (select count(*) from auth.users),
    'nuevos7',  (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'activos7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'pro',      (select count(*) from public.profiles where plan = 'pro' and (plan_until is null or plan_until > now())),
    'push',     (select count(distinct user_id) from public.push_subs),
    'gastos',   (select count(*) from public.docs where collection = 'gastos'),
    'envios',   (select coalesce(json_agg(e order by e.creado desc), '[]'::json) from (select titulo, publico, enviados, fallidos, creado from public.push_envios order by creado desc limit 5) e));
end $$;

-- 5) Lista de usuarios
create or replace function public.admin_usuarios() returns table(email text, registro date, ultima_vez date, tipo text, pro_hasta date, push boolean, gastos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  return query
  select u.email::text, u.created_at::date, u.last_sign_in_at::date,
         case when p.rol = 'desarrollador' then 'desarrollador'
              when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'normal' end,
         p.plan_until::date,
         exists(select 1 from public.push_subs s where s.user_id = u.id),
         (select count(*) from public.docs d where d.user_id = u.id and d.collection = 'gastos')
  from auth.users u left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end $$;

-- 6) Cambiar plan desde el panel (usa la misma lógica que dar_plan)
create or replace function public.admin_plan(correo text, tipo text, dias int default null) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  select id into uid from auth.users where lower(email) = lower(correo);
  if uid is null then return 'No existe ese usuario'; end if;
  if tipo not in ('normal','pro','desarrollador') then return 'Tipo inválido'; end if;
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  update public.profiles set
    plan = case when tipo = 'normal' then 'free' else 'pro' end,
    plan_until = case when tipo = 'pro' and dias is not null then now() + make_interval(days => dias) else null end,
    rol = case when tipo = 'desarrollador' then 'desarrollador' else null end
  where id = uid;
  return correo || ' ahora es ' || tipo || coalesce(' por ' || dias || ' días', '');
end $$;

revoke all on function public.admin_resumen(), public.admin_usuarios(), public.admin_plan(text,text,int) from public, anon;
grant execute on function public.admin_resumen(), public.admin_usuarios(), public.admin_plan(text,text,int), public.es_dev() to authenticated;

-- 7) Para la función de envío (solo service_role): usuarios con su tipo
create or replace function public.admin_usuarios_srv() returns table(id uuid, email text, tipo text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text,
         case when p.rol = 'desarrollador' then 'desarrollador'
              when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'normal' end
  from auth.users u left join public.profiles p on p.id = u.id
$$;
revoke all on function public.admin_usuarios_srv() from public, anon, authenticated;
grant execute on function public.admin_usuarios_srv() to service_role;
