-- KPI de rematrícula: estado de cartera (rematriculable / no) y RUT con dos carreras vigentes.
-- CREATE OR REPLACE no puede cambiar el tipo de retorno, por eso se recrea la función.

DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer);

CREATE FUNCTION public.kpi_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer
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
  matriculado integer,
  rematriculables integer,
  no_rematriculables integer,
  rut_dos_carreras text,
  detalle_dos_carreras text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dos_carreras AS (
    SELECT
      c.rut_alumno,
      string_agg(c.nombre_carrera, ' · ' ORDER BY c.codigo_carrera) AS detalle
    FROM public.mnp_mv_plan_pagos_consolidado c
    WHERE upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE'
      AND c.rut_alumno IS NOT NULL
      AND btrim(c.rut_alumno) <> ''
    GROUP BY c.rut_alumno
    HAVING count(*) > 1
  )
  SELECT
    count(*)::integer AS total_cartera,
    count(*) FILTER (WHERE p.excluido_mol)::integer AS excluidos_mol,
    count(*) FILTER (WHERE p.sin_match_mol)::integer AS sin_match,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'sin_ingreso')::integer AS sin_ingreso,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'ingreso')::integer AS ingreso,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'tyc')::integer AS tyc,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'datos')::integer AS datos,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'forma_pago')::integer AS forma_pago,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'firma')::integer AS firma,
    count(*) FILTER (WHERE p.excluido_mol = false AND p.sin_match_mol = false AND p.etapa_actual = 'matriculado')::integer AS matriculado,
    count(*) FILTER (WHERE p.rematriculable)::integer AS rematriculables,
    count(*) FILTER (WHERE NOT p.rematriculable)::integer AS no_rematriculables,
    (SELECT string_agg(d.rut_alumno, ', ' ORDER BY d.rut_alumno) FROM dos_carreras d) AS rut_dos_carreras,
    (SELECT string_agg(d.detalle, ' | ' ORDER BY d.rut_alumno) FROM dos_carreras d) AS detalle_dos_carreras
  FROM public.mnp_progreso_rematricula p
  WHERE p.anio_periodo = p_anio
    AND p.semestre_periodo = p_semestre;
$$;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer) IS
  'Agregados del embudo y estado de cartera (rematriculable / no) para el periodo. rut_dos_carreras sale de la nómina con dos filas vigentes.';

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer)
  TO anon, authenticated, service_role;
