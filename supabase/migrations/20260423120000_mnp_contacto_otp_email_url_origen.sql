-- Entornos que ya aplicaron 20260422120000 sin url_origen.
alter table public.mnp_contacto_otp_email
  add column if not exists url_origen text null;

comment on column public.mnp_contacto_otp_email.url_origen is
  'URL del front desde la que se solicitó el OTP (p. ej. href completo).';
