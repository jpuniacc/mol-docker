-- Sin ingreso del embudo incluye excluido_mol (SUBDERE / fuera MOL),
-- para que sume con la cartera y no confunda (4690 vs 4628).
-- El resto de etapas sigue sin contar excluidos ni sin_match.

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
  no_rematriculable_eliminado integer,
  forma_pago_espera_cae integer,
  forma_pago_espera_ministerial integer,
  forma_pago_espera_ambos integer,
  forma_pago_resto integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*, c.estado_academico
    FROM public.mnp_progreso_rematricula p
    LEFT JOIN public.mnp_mv_plan_pagos_consolidado c ON c.codcli = p.codcli
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND (
        p_email_ejecutivo IS NULL
        OR btrim(p_email_ejecutivo) = ''
        OR EXISTS (
          SELECT 1
          FROM public.mnp_cartera_oficial co
          WHERE co.rut_norm = p.rut_norm
            AND lower(btrim(co.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
        )
      )
  ),
  dos_carreras AS (
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
  ),
  embudo AS (
    SELECT *
    FROM base
    WHERE excluido_mol = false AND sin_match_mol = false
  )
  SELECT
    (SELECT count(*)::integer FROM base) AS total_cartera,
    (SELECT count(*) FILTER (WHERE excluido_mol)::integer FROM base) AS excluidos_mol,
    (SELECT count(*) FILTER (WHERE sin_match_mol)::integer FROM base) AS sin_match,
    -- Incluye excluido_mol (p. ej. SUBDERE): siguen en sin_ingreso y deben sumar a cartera.
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'sin_ingreso' AND sin_match_mol = false
    )::integer FROM base) AS sin_ingreso,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'ingreso')::integer FROM embudo) AS ingreso,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'tyc')::integer FROM embudo) AS tyc,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'datos')::integer FROM embudo) AS datos,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'forma_pago')::integer FROM embudo) AS forma_pago,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'firma')::integer FROM embudo) AS firma,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'matriculado')::integer FROM embudo) AS matriculado,
    (SELECT count(*) FILTER (WHERE rematriculable)::integer FROM base) AS rematriculables,
    (SELECT count(*) FILTER (WHERE NOT rematriculable)::integer FROM base) AS no_rematriculables,
    (SELECT string_agg(DISTINCT d.rut_alumno, ', ' ORDER BY d.rut_alumno) FROM dos_carreras d) AS rut_dos_carreras,
    (SELECT jsonb_agg(
      jsonb_build_object('codcli', d.codcli, 'nombre_carrera', d.nombre_carrera)
      ORDER BY d.rut_alumno, d.codigo_carrera
    ) FROM dos_carreras d) AS detalle_dos_carreras,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'VIGENTE')::integer FROM base) AS rematriculable_vigente,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'SUSPENDIDO')::integer FROM base) AS rematriculable_suspendido,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'ELIMINADO')::integer FROM base) AS rematriculable_eliminado,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'VIGENTE')::integer FROM base) AS no_rematriculable_vigente,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'SUSPENDIDO')::integer FROM base) AS no_rematriculable_suspendido,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'ELIMINADO')::integer FROM base) AS no_rematriculable_eliminado,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_cae AND NOT espera_ministerial
    )::integer FROM embudo) AS forma_pago_espera_cae,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_ministerial AND NOT espera_cae
    )::integer FROM embudo) AS forma_pago_espera_ministerial,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_cae AND espera_ministerial
    )::integer FROM embudo) AS forma_pago_espera_ambos,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND NOT espera_cae AND NOT espera_ministerial
    )::integer FROM embudo) AS forma_pago_resto;
$$;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) IS
  'Agregados del embudo. sin_ingreso incluye excluido_mol; resto de etapas no. Desglose forma_pago CAE/Ministerial.';
