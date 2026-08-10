-- Intentos fallidos y exitosos en la misma tabla; RPC unificada.

alter table public.log_inicio_sesion
  add column if not exists exitoso boolean not null default true;

alter table public.log_inicio_sesion
  add column if not exists mensaje_error text null;

update public.log_inicio_sesion
set exitoso = true
where exitoso is distinct from false;

alter table public.log_inicio_sesion
  alter column email drop not null;

alter table public.log_inicio_sesion
  alter column usuario_local drop not null;

alter table public.log_inicio_sesion
  drop constraint if exists log_inicio_sesion_auth_source_chk;

alter table public.log_inicio_sesion
  add constraint log_inicio_sesion_auth_source_chk
    check (
      auth_source in (
        'mv_ldap',
        'pixarron',
        'validacion',
        'supabase'
      )
    );

alter table public.log_inicio_sesion
  add constraint log_inicio_sesion_exito_ident_chk
    check (
      exitoso = false
      or (
        email is not null
        and length(trim(email)) > 0
        and usuario_local is not null
        and length(trim(usuario_local)) > 0
      )
    );

alter table public.log_inicio_sesion
  add constraint log_inicio_sesion_fallo_ident_chk
    check (
      exitoso = true
      or (
        (email is not null and length(trim(email)) > 0)
        or (usuario_local is not null and length(trim(usuario_local)) > 0)
      )
    );

alter table public.log_inicio_sesion
  add constraint log_inicio_sesion_mensaje_exito_chk
    check (exitoso = false or mensaje_error is null);

comment on table public.log_inicio_sesion is 'Auditoría de intentos de inicio de sesión (éxitos y fallos; sin contraseñas).';

comment on column public.log_inicio_sesion.exitoso is 'true si el login completó; false si falló validación, LDAP, Pixarron o consulta.';
comment on column public.log_inicio_sesion.mensaje_error is 'Motivo genérico del fallo (truncado en cliente; nunca contraseña).';

drop function if exists public.registrar_log_inicio_sesion(text, text, text, text, uuid, text);

create or replace function public.registrar_log_inicio_sesion(
  p_auth_source text,
  p_email text default null,
  p_usuario_local text default null,
  p_tipo_pixarron text default null,
  p_mv_usuario_id uuid default null,
  p_url_origen text default null,
  p_exitoso boolean default true,
  p_mensaje_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_local text := nullif(trim(coalesce(p_usuario_local, '')), '');
  v_msg text := nullif(trim(coalesce(p_mensaje_error, '')), '');
begin
  if p_auth_source is null
     or p_auth_source not in ('mv_ldap', 'pixarron', 'validacion', 'supabase') then
    raise exception 'auth_source inválido';
  end if;

  if p_exitoso then
    if v_email is null or v_local is null then
      raise exception 'email y usuario_local requeridos si exitoso';
    end if;
    if v_msg is not null then
      raise exception 'mensaje_error debe ser null si exitoso';
    end if;
  else
    if v_email is null and v_local is null then
      raise exception 'se requiere email o usuario_local en intento fallido';
    end if;
    if v_msg is null then
      raise exception 'mensaje_error requerido si no exitoso';
    end if;
    if length(v_msg) > 1024 then
      raise exception 'mensaje_error demasiado largo';
    end if;
  end if;

  if v_email is not null and length(v_email) > 512 then
    raise exception 'longitud email excedida';
  end if;
  if v_local is not null and length(v_local) > 512 then
    raise exception 'longitud usuario_local excedida';
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
    url_origen,
    exitoso,
    mensaje_error
  )
  values (
    v_email,
    v_local,
    p_auth_source,
    case when p_exitoso then nullif(trim(p_tipo_pixarron), '') else null end,
    case when p_exitoso then p_mv_usuario_id else null end,
    nullif(trim(coalesce(p_url_origen, '')), ''),
    p_exitoso,
    case when p_exitoso then null else v_msg end
  );
end;
$$;

comment on function public.registrar_log_inicio_sesion is 'Inserta intento de sesión (éxito o fallo); ejecutable por anon.';

grant execute on function public.registrar_log_inicio_sesion(
  text, text, text, text, uuid, text, boolean, text
) to anon;

grant execute on function public.registrar_log_inicio_sesion(
  text, text, text, text, uuid, text, boolean, text
) to authenticated;
