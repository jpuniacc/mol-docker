-- Tabla de auditoría: inicios de sesión exitosos (sin contraseñas).
-- Ejecutar con Supabase CLI o pegar en SQL Editor del proyecto.

create table if not exists public.log_inicio_sesion (
  id uuid not null default gen_random_uuid() primary key,
  creado_en timestamptz not null default now(),
  email text not null,
  usuario_local text not null,
  auth_source text not null,
  tipo_pixarron text null,
  mv_usuario_id uuid null,
  url_origen text null,
  constraint log_inicio_sesion_auth_source_chk
    check (auth_source in ('mv_ldap', 'pixarron')),
  constraint fk_log_inicio_sesion_mv_usuario
    foreign key (mv_usuario_id)
    references public.mv_usuario (id)
    on delete set null
);

create index if not exists idx_log_inicio_sesion_creado_en
  on public.log_inicio_sesion (creado_en desc);

comment on table public.log_inicio_sesion is 'Auditoría de inicios de sesión exitosos (LDAP vía mv_usuario o API Pixarron).';

comment on column public.log_inicio_sesion.url_origen is 'URL de la página desde donde se inició sesión (p. ej. href del login).';

alter table public.log_inicio_sesion enable row level security;

-- Sin acceso directo para roles públicos; el insert solo vía RPC SECURITY DEFINER.
create policy "log_inicio_sesion_no_select_anon"
  on public.log_inicio_sesion
  for select
  to anon
  using (false);

create policy "log_inicio_sesion_no_insert_anon"
  on public.log_inicio_sesion
  for insert
  to anon
  with check (false);

create policy "log_inicio_sesion_no_select_authenticated"
  on public.log_inicio_sesion
  for select
  to authenticated
  using (false);

create policy "log_inicio_sesion_no_insert_authenticated"
  on public.log_inicio_sesion
  for insert
  to authenticated
  with check (false);

create or replace function public.registrar_log_inicio_sesion(
  p_email text,
  p_usuario_local text,
  p_auth_source text,
  p_tipo_pixarron text default null,
  p_mv_usuario_id uuid default null,
  p_url_origen text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email requerido';
  end if;
  if p_usuario_local is null or length(trim(p_usuario_local)) = 0 then
    raise exception 'usuario_local requerido';
  end if;
  if p_auth_source is null or p_auth_source not in ('mv_ldap', 'pixarron') then
    raise exception 'auth_source inválido';
  end if;
  if length(p_email) > 512 or length(p_usuario_local) > 512 then
    raise exception 'longitud excedida';
  end if;
  if p_tipo_pixarron is not null and length(p_tipo_pixarron) > 256 then
    raise exception 'tipo_pixarron demasiado largo';
  end if;
  if p_url_origen is not null and length(p_url_origen) > 2048 then
    raise exception 'url_origen demasiado larga';
  end if;

  insert into public.log_inicio_sesion (
    email,
    usuario_local,
    auth_source,
    tipo_pixarron,
    mv_usuario_id,
    url_origen
  )
  values (
    trim(p_email),
    trim(p_usuario_local),
    p_auth_source,
    nullif(trim(p_tipo_pixarron), ''),
    p_mv_usuario_id,
    nullif(trim(p_url_origen), '')
  );
end;
$$;

comment on function public.registrar_log_inicio_sesion is 'Inserta fila de log; ejecutable por anon sin exponer INSERT directo en la tabla.';

grant execute on function public.registrar_log_inicio_sesion(text, text, text, text, uuid, text) to anon;
grant execute on function public.registrar_log_inicio_sesion(text, text, text, text, uuid, text) to authenticated;
