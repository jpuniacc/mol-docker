BEGIN;
SET LOCAL lock_timeout='5s';
-- Origin of the stage-reminder recipient: validated by the student in MOL, or academic fallback (mv_matriculados_sync).
-- Additive only; no flags, recipients or communications are changed by this migration.
ALTER TABLE public.mnp_retencion_etapa_auditoria
 ADD COLUMN IF NOT EXISTS fuente_contacto text CHECK (fuente_contacto IS NULL OR fuente_contacto IN ('validado','academico_personal','academico_institucional'));
COMMIT;
