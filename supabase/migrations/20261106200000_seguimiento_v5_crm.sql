-- Seguimiento CRM v5: origen 'sistema' en bitácora (eventos Webpay / TuFirma / matricular).

ALTER TABLE public.mnp_seguimiento_contacto
  DROP CONSTRAINT IF EXISTS mnp_seguimiento_contacto_origen_check;

ALTER TABLE public.mnp_seguimiento_contacto
  ADD CONSTRAINT mnp_seguimiento_contacto_origen_check
  CHECK (origen IN ('manual', 'auto', 'sistema'));

CREATE INDEX IF NOT EXISTS mnp_seguimiento_contacto_sistema_dia_idx
  ON public.mnp_seguimiento_contacto (codcli, anio_periodo, semestre_periodo, canal, created_at DESC)
  WHERE origen = 'sistema';

COMMENT ON COLUMN public.mnp_seguimiento_contacto.origen IS
  'manual = ejecutivo; auto = automatismos; sistema = hitos Webpay/TuFirma/matrícula';
