-- Permite avisos al actualizar datos de apoderado desde ERP (refresh consejero).

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_tipo_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_tipo_check
  CHECK (tipo IN (
    'TYC_RECHAZO',
    'CONVENIO_CERTIFICADO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA'
  ));

COMMENT ON CONSTRAINT mnp_aviso_consejero_tipo_check ON public.mnp_aviso_consejero IS
  'Tipos de aviso outbox; APODERADO_ACTUALIZADO = datos refrescados desde ERP.';
