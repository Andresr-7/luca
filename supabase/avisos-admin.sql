-- Luca · Avisos dentro de la app + acciones extra del panel. Ejecutar UNA vez (elige "Run without RLS").
create table if not exists public.app_avisos (
  id bigint generated always as identity primary key,
  titulo text not null, cuerpo text not null,
  publico text not null default 'todos',   -- todos | pro | normal
  activo boolean not null default true,
  creado timestamptz default now()
);
alter table public.app_avisos enable row level security;
drop policy if exists "avisos: leer activos" on public.app_avisos;
create policy "avisos: leer activos" on public.app_avisos for select to authenticated using (activo);

create or replace function public.admin_aviso(titulo text, cuerpo text, publico text default 'todos') returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  insert into public.app_avisos (titulo, cuerpo, publico) values (left(titulo,60), left(cuerpo,240), publico);
  return 'Aviso publicado';
end $$;

create or replace function public.admin_avisos_quitar() returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  update public.app_avisos set activo = false where activo;
  return 'Avisos quitados';
end $$;

create or replace function public.admin_actividad() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  return json_build_object(
    'gastos_hoy', (select count(*) from public.docs where collection='gastos' and updated_at > date_trunc('day', now())),
    'gastos_7',   (select count(*) from public.docs where collection='gastos' and updated_at > now() - interval '7 days'),
    'tarjetas',   (select count(*) from public.docs where collection='tarjetas'),
    'recibos',    (select count(*) from public.docs where collection='gastos' and data ? 'recibo'),
    'por_dia',    (select coalesce(json_agg(x order by x.dia), '[]'::json) from (
                     select to_char(d, 'DD/MM') as dia,
                            (select count(*) from public.docs where collection='gastos' and updated_at::date = d::date) as n
                     from generate_series(now()::date - 6, now()::date, interval '1 day') d) x));
end $$;
revoke all on function public.admin_aviso(text,text,text), public.admin_avisos_quitar(), public.admin_actividad() from public, anon;
grant execute on function public.admin_aviso(text,text,text), public.admin_avisos_quitar(), public.admin_actividad() to authenticated;
