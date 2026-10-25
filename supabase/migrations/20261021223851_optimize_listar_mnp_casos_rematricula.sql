-- El listado dejaba de usar el índice de la cartera porque normalizaba el RUT en cada fila.
-- Postgres arma el plazo al empezar el llamado, así que el de 10 segundos queda en el rol anon.

ALTER FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer)
  RESET statement_timeout;

ALTER ROLE anon SET statement_timeout = '10s';

ALTER TABLE public.mnp_caso_rematricula
  ADD COLUMN IF NOT EXISTS rut_norm text
  GENERATED ALWAYS AS (
    regexp_replace(
      upper(replace(replace(coalesce(rut_alumno, ''), '.', ''), '-', '')),
      '[^0-9K]',
      '',
      'g'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_mnp_caso_rematricula_rut_norm
  ON public.mnp_caso_rematricula (rut_norm);

CREATE INDEX IF NOT EXISTS idx_mnp_caso_rematricula_updated
  ON public.mnp_caso_rematricula (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_cartera_oficial_ejecutivo_rut
  ON public.mnp_cartera_oficial (lower(btrim(email_ejecutivo)), rut_norm);

CREATE OR REPLACE FUNCTION public.listar_mnp_casos_rematricula(
  p_periodo text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_email_ejecutivo text DEFAULT NULL
)
RETURNS SETOF public.mnp_caso_rematricula
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT caso.*
  FROM public.mnp_caso_rematricula caso
  WHERE (p_periodo IS NULL OR caso.periodo = p_periodo)
    AND (p_tipo IS NULL OR caso.tipo = p_tipo)
    AND (p_estado IS NULL OR caso.estado = p_estado)
    AND (
      p_email_ejecutivo IS NULL
      OR btrim(p_email_ejecutivo) = ''
      OR EXISTS (
        SELECT 1
        FROM public.mnp_cartera_oficial c
        WHERE c.rut_norm = caso.rut_norm
          AND lower(btrim(c.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
      )
    )
  ORDER BY caso.updated_at DESC;
$$;

COMMENT ON FUNCTION public.listar_mnp_casos_rematricula(text, text, text, text) IS
  'Lista casos. Con p_email_ejecutivo, solo la cartera de ese ejecutivo.';
