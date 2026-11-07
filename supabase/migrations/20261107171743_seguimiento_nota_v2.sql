-- Nota v2: fecha real del contacto y próxima acción estructurada.
-- Idempotente; conserva campos legacy, datos, permisos y políticas existentes.
SET lock_timeout = '5s';
ALTER TABLE public.mnp_seguimiento_contacto
  ADD COLUMN IF NOT EXISTS fecha_contacto timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_accion_at timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_accion_canales text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proxima_accion_comentario text;
UPDATE public.mnp_seguimiento_contacto
   SET fecha_contacto = created_at
 WHERE fecha_contacto IS NULL;
ALTER TABLE public.mnp_seguimiento_contacto
  ALTER COLUMN fecha_contacto SET DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_seguimiento_contacto_fecha_real
  ON public.mnp_seguimiento_contacto
  (codcli, anio_periodo, semestre_periodo, (coalesce(fecha_contacto, created_at)) DESC);
COMMENT ON COLUMN public.mnp_seguimiento_contacto.fecha_contacto IS 'Instante real del contacto; presentación America/Santiago';
COMMENT ON COLUMN public.mnp_seguimiento_contacto.proxima_accion_canales IS 'Canales previstos; registrar una acción no dispara envíos';
