-- Si ya existía `log_inicio_sesion` sin `url_origen` o con la RPC de 5 parámetros, aplicar este script.

alter table public.log_inicio_sesion
  add column if not exists url_origen text null;

comment on column public.log_inicio_sesion.url_origen is 'URL de la página desde donde se inició sesión (p. ej. window.location.href).';

drop function if exists public.registrar_log_inicio_sesion(text, text, text, text, uuid);

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

grant execute on function public.registrar_log_inicio_sesion(text, text, text, text, uuid, text) to anon;
grant execute on function public.registrar_log_inicio_sesion(text, text, text, text, uuid, text) to authenticated;
