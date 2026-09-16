-- Claim corto del outbox: reservar filas antes de ejecutar SMTP fuera de la transacción.

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_estado_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_estado_check
  CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'error', 'omitido'));

DROP INDEX IF EXISTS public.idx_mnp_aviso_pendiente;
CREATE INDEX idx_mnp_aviso_pendiente
  ON public.mnp_aviso_consejero (estado, created_at)
  WHERE estado IN ('pendiente', 'error');
