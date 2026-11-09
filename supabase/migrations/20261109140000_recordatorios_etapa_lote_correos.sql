BEGIN;
SET LOCAL lock_timeout='5s';
-- Durable email-batch state for stage reminders: max N emails per batch and >= M minutes between batch starts.
-- Additive only; no flags, mode or communications are changed by this migration.
ALTER TABLE public.mnp_retencion_etapa_control
 ADD COLUMN IF NOT EXISTS correo_lote_inicio timestamptz,
 ADD COLUMN IF NOT EXISTS correo_lote_enviados integer NOT NULL DEFAULT 0 CHECK(correo_lote_enviados>=0);
COMMIT;
