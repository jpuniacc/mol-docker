-- KPI: alumnos con reserva de descuento de matrícula (CAE / BECA / CAE Y BECA).

CREATE OR REPLACE FUNCTION public.kpi_reserva_descuento_matricula(
  p_anio integer,
  p_semestre integer
)
RETURNS TABLE (
  total bigint,
  por_cae bigint,
  por_beca bigint,
  por_cae_y_beca bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_anio IS NULL OR p_semestre IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT ON (r.codcli)
      r.codcli,
      r.motivo,
      k.consolidado
    FROM public.mnp_reserva_descuento_matricula r
    LEFT JOIN public.mnp_cartera_consolidado k
      ON k.rut_norm = upper(regexp_replace(coalesce(r.rut_alumno, ''), '[^0-9K]', '', 'g'))
    WHERE r.anio_periodo = p_anio
      AND r.semestre_periodo = p_semestre
    ORDER BY
      r.codcli,
      CASE
        WHEN upper(trim(coalesce(k.consolidado, ''))) LIKE '%CAE%/%BECA%' THEN 0
        WHEN upper(trim(coalesce(k.consolidado, ''))) LIKE '%BECA%' THEN 1
        WHEN upper(trim(coalesce(k.consolidado, ''))) LIKE '%CAE%' THEN 2
        ELSE 3
      END
  ),
  clasificado AS (
    SELECT
      CASE
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%CAE%/%BECA%' THEN 'CAE_Y_BECA'
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%BECA%' THEN 'BECA'
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%CAE%' THEN 'CAE'
        WHEN motivo = 'ESTATAL' THEN 'BECA'
        ELSE 'CAE'
      END AS bucket
    FROM base
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE bucket = 'CAE')::bigint AS por_cae,
    count(*) FILTER (WHERE bucket = 'BECA')::bigint AS por_beca,
    count(*) FILTER (WHERE bucket = 'CAE_Y_BECA')::bigint AS por_cae_y_beca
  FROM clasificado;
END;
$$;

COMMENT ON FUNCTION public.kpi_reserva_descuento_matricula(integer, integer) IS
  'Totales de reservas de descuento matrícula del periodo: CAE, BECA (ministerial) y CAE Y BECA.';

GRANT EXECUTE ON FUNCTION public.kpi_reserva_descuento_matricula(integer, integer)
  TO anon, authenticated, service_role;
