-- Desglose del KPI por estado académico de la nómina (VIGENTE / SUSPENDIDO / ELIMINADO).

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
  detalle_dos_carreras jsonb,
  rematriculable_vigente integer,
  rematriculable_suspendido integer,
  rematriculable_eliminado integer,
  no_rematriculable_vigente integer,
  no_rematriculable_suspendido integer,
  no_rematriculable_eliminado integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dos_carreras AS (
    SELECT
      c.rut_alumno,
      c.codcli,
      c.nombre_carrera,
      c.codigo_carrera
    FROM public.mnp_mv_plan_pagos_consolidado c
    WHERE upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE'
      AND c.rut_alumno IS NOT NULL
      AND btrim(c.rut_alumno) <> ''
      AND c.rut_alumno IN (
        SELECT c2.rut_alumno
        FROM public.mnp_mv_plan_pagos_consolidado c2
        WHERE upper(btrim(coalesce(c2.estado_academico, ''))) = 'VIGENTE'
          AND c2.rut_alumno IS NOT NULL
          AND btrim(c2.rut_alumno) <> ''
        GROUP BY c2.rut_alumno
        HAVING count(*) > 1
      )
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
    (SELECT string_agg(DISTINCT d.rut_alumno, ', ' ORDER BY d.rut_alumno) FROM dos_carreras d) AS rut_dos_carreras,
    (SELECT jsonb_agg(
      jsonb_build_object('codcli', d.codcli, 'nombre_carrera', d.nombre_carrera)
      ORDER BY d.rut_alumno, d.codigo_carrera
    ) FROM dos_carreras d) AS detalle_dos_carreras,
    count(*) FILTER (WHERE p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE')::integer AS rematriculable_vigente,
    count(*) FILTER (WHERE p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'SUSPENDIDO')::integer AS rematriculable_suspendido,
    count(*) FILTER (WHERE p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'ELIMINADO')::integer AS rematriculable_eliminado,
    count(*) FILTER (WHERE NOT p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE')::integer AS no_rematriculable_vigente,
    count(*) FILTER (WHERE NOT p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'SUSPENDIDO')::integer AS no_rematriculable_suspendido,
    count(*) FILTER (WHERE NOT p.rematriculable AND upper(btrim(coalesce(c.estado_academico, ''))) = 'ELIMINADO')::integer AS no_rematriculable_eliminado
  FROM public.mnp_progreso_rematricula p
  LEFT JOIN public.mnp_mv_plan_pagos_consolidado c ON c.codcli = p.codcli
  WHERE p.anio_periodo = p_anio
    AND p.semestre_periodo = p_semestre;
$$;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer) IS
  'Agregados del embudo, rematriculable / no, y desglose por estado académico de la nómina.';

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer)
  TO anon, authenticated, service_role;
