-- Luca · Qué versión de la app tiene cada usuario. Ejecutar UNA vez (elige "Run without RLS").
create table if not exists public.app_versiones (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  version text not null,
  plataforma text not null,      -- android | pwa | web
  nativa text,                   -- versión del instalable de Play (solo android)
  visto timestamptz not null default now()
);
alter table public.app_versiones enable row level security;
drop policy if exists "versiones: la mía" on public.app_versiones;
create policy "versiones: la mía" on public.app_versiones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.app_versiones from anon;

create or replace function public.admin_versiones() returns table(email text, version text, plataforma text, nativa text, visto timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dev() then raise exception 'Solo desarrolladores' using errcode = '42501'; end if;
  return query select u.email::text, v.version, v.plataforma, v.nativa, v.visto
    from auth.users u left join public.app_versiones v on v.user_id = u.id
    order by v.visto desc nulls last;
end $$;
revoke all on function public.admin_versiones() from public, anon;
grant execute on function public.admin_versiones() to authenticated;
