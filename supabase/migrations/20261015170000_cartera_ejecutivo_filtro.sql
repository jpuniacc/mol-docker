-- El ejecutivo ve solo su cartera. Sin correo, el resultado sigue completo.

DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer);
DROP FUNCTION IF EXISTS public.listar_mnp_progreso_rematricula(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.listar_mnp_casos_rematricula(text, text, text);

CREATE OR REPLACE FUNCTION public.kpi_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer,
  p_email_ejecutivo text DEFAULT NULL
)
RETURNS TABLE (
  total_cartera integer,
  excluidos_mol integer,
  sin_match integer,
  sin_ingreso integer,
  ingreso integer,
  tyc integer,
  datos integer,
  forma_pago integer,
  firma integer,
  matriculado integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::integer AS total_cartera,
    count(*) FILTER (WHERE excluido_mol)::integer AS excluidos_mol,
    count(*) FILTER (WHERE sin_match_mol)::integer AS sin_match,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'sin_ingreso')::integer AS sin_ingreso,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'ingreso')::integer AS ingreso,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'tyc')::integer AS tyc,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'datos')::integer AS datos,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'forma_pago')::integer AS forma_pago,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'firma')::integer AS firma,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'matriculado')::integer AS matriculado
  FROM public.mnp_progreso_rematricula p
  WHERE p.anio_periodo = p_anio
    AND p.semestre_periodo = p_semestre
    AND (
      p_email_ejecutivo IS NULL
      OR btrim(p_email_ejecutivo) = ''
      OR EXISTS (
        SELECT 1
        FROM public.mnp_cartera_oficial c
        WHERE c.rut_norm = p.rut_norm
          AND lower(btrim(c.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.listar_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer,
  p_etapa text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_email_ejecutivo text DEFAULT NULL
)
RETURNS SETOF public.mnp_progreso_rematricula
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.mnp_progreso_rematricula p
  WHERE p.anio_periodo = p_anio
    AND p.semestre_periodo = p_semestre
    AND (p_etapa IS NULL OR p.etapa_actual = p_etapa)
    AND (
      p_q IS NULL
      OR p.rut ILIKE '%' || p_q || '%'
      OR p.nombre_alumno ILIKE '%' || p_q || '%'
      OR p.codcli ILIKE '%' || p_q || '%'
    )
    AND (
      p_email_ejecutivo IS NULL
      OR btrim(p_email_ejecutivo) = ''
      OR EXISTS (
        SELECT 1
        FROM public.mnp_cartera_oficial c
        WHERE c.rut_norm = p.rut_norm
          AND lower(btrim(c.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
      )
    )
  ORDER BY p.ultima_actividad_en DESC NULLS LAST
  LIMIT 5000;
$$;

CREATE OR REPLACE FUNCTION public.listar_mnp_casos_rematricula(
  p_periodo text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_email_ejecutivo text DEFAULT NULL
)
RETURNS SETOF public.mnp_caso_rematricula
LANGUAGE sql
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
        WHERE c.rut_norm = regexp_replace(
          upper(replace(replace(coalesce(caso.rut_alumno, ''), '.', ''), '-', '')),
          '[^0-9K]',
          '',
          'g'
        )
        AND lower(btrim(c.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
      )
    )
  ORDER BY caso.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_mnp_progreso_rematricula(integer, integer, text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_mnp_casos_rematricula(text, text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) IS
  'Agregados del embudo. Con p_email_ejecutivo, solo la cartera de ese ejecutivo.';
COMMENT ON FUNCTION public.listar_mnp_progreso_rematricula(integer, integer, text, text, text) IS
  'Lista el progreso. Con p_email_ejecutivo, solo la cartera de ese ejecutivo.';
COMMENT ON FUNCTION public.listar_mnp_casos_rematricula(text, text, text, text) IS
  'Lista casos. Con p_email_ejecutivo, solo la cartera de ese ejecutivo.';
