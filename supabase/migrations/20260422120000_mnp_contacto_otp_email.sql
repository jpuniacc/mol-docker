-- OTP correo personal (rematricula mock). Solo consumo vía uniacc-api (rol DB de aplicación).
-- No exponer a PostgREST: revocar a anon/authenticated.

create table if not exists public.mnp_contacto_otp_email (
  id uuid primary key default gen_random_uuid(),
  usuario_conexion text not null,
  email_institucional_norm text not null,
  email_personal_norm text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verify_attempts integer not null default 0,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  url_origen text null
);

comment on column public.mnp_contacto_otp_email.url_origen is
  'URL del front desde la que se solicitó el OTP (p. ej. href completo).';

comment on table public.mnp_contacto_otp_email is
  'Códigos OTP para validar correo personal en matrícula; hash del código, caducidad 5 min; uso exclusivo servidor.';

create index if not exists mnp_contacto_otp_email_active_idx
  on public.mnp_contacto_otp_email (
    lower(usuario_conexion),
    lower(email_personal_norm)
  )
  where consumed_at is null;

create index if not exists mnp_contacto_otp_email_expires_idx
  on public.mnp_contacto_otp_email (expires_at)
  where consumed_at is null;

revoke all on public.mnp_contacto_otp_email from public;
revoke all on public.mnp_contacto_otp_email from anon;
revoke all on public.mnp_contacto_otp_email from authenticated;

-- Si uniacc-api usa un rol distinto de postgres, conceder explícitamente a ese rol:
-- grant select, insert, update, delete on public.mnp_contacto_otp_email to tu_rol_api;
