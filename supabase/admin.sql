-- Luca · Administración de usuarios (solo para el dueño, desde Supabase → SQL Editor)
-- Ejecuta este archivo UNA vez. Luego usa las consultas de abajo.

-- 1) Función para cambiar el tipo de usuario: 'normal', 'pro' o 'desarrollador'
--    dias: cuántos días dura el Pro (null = sin vencimiento)
create or replace function public.dar_plan(correo text, tipo text, dias int default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(correo);
  if uid is null then return 'No existe un usuario con ese correo'; end if;
  if tipo not in ('normal','pro','desarrollador') then return 'Tipo inválido: usa normal, pro o desarrollador'; end if;
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  update public.profiles set
    plan       = case when tipo = 'normal' then 'free' else 'pro' end,
    plan_until = case when tipo = 'pro' and dias is not null then now() + make_interval(days => dias) else null end,
    rol        = case when tipo = 'desarrollador' then 'desarrollador' else null end
  where id = uid;
  return correo || ' ahora es ' || tipo || coalesce(' por ' || dias || ' días', '');
end $$;
-- Nadie la puede llamar desde la app; solo tú desde el SQL Editor
revoke all on function public.dar_plan(text, text, int) from public, anon, authenticated;

-- 2) Ver todos los usuarios y su tipo
-- select u.email, u.created_at::date as registro, u.last_sign_in_at::date as ultima_vez,
--        case when p.rol = 'desarrollador' then 'desarrollador'
--             when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro'
--             else 'normal' end as tipo,
--        p.plan_until::date as pro_hasta
-- from auth.users u left join public.profiles p on p.id = u.id
-- order by u.created_at;

-- 3) Ejemplos
-- select public.dar_plan('amigo@gmail.com', 'pro');          -- Pro sin vencimiento
-- select public.dar_plan('amigo@gmail.com', 'pro', 30);      -- Pro por 30 días
-- select public.dar_plan('tucorreo@gmail.com', 'desarrollador');
-- select public.dar_plan('amigo@gmail.com', 'normal');       -- quitar Pro
