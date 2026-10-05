-- OTP SMS contacto (rematrícula). Solo consumo vía uniacc-api.
-- No exponer a PostgREST: revocar a anon/authenticated.

create table if not exists public.mnp_contacto_otp_sms (
  id uuid primary key default gen_random_uuid(),
  usuario_conexion text not null,
  email_institucional_norm text not null,
  telefono_norm text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verify_attempts integer not null default 0,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  url_origen text null,
  sms_tracer text null
);

comment on table public.mnp_contacto_otp_sms is
  'Códigos OTP para validar teléfono en matrícula; hash del código; uso exclusivo servidor.';

comment on column public.mnp_contacto_otp_sms.telefono_norm is
  'Móvil en dígitos internacionales, sin signo más. Ejemplo: 56912345678.';

comment on column public.mnp_contacto_otp_sms.sms_tracer is
  'Identificador meta.tracer devuelto por Celmedia al aceptar el SMS.';

create index if not exists mnp_contacto_otp_sms_active_idx
  on public.mnp_contacto_otp_sms (
    lower(usuario_conexion),
    lower(telefono_norm)
  )
  where consumed_at is null;

create index if not exists mnp_contacto_otp_sms_expires_idx
  on public.mnp_contacto_otp_sms (expires_at)
  where consumed_at is null;

revoke all on public.mnp_contacto_otp_sms from public;
revoke all on public.mnp_contacto_otp_sms from anon;
revoke all on public.mnp_contacto_otp_sms from authenticated;
