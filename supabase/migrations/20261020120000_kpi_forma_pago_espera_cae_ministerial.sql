-- Marca alumnos en espera de resolución CAE / Beca Ministerial dentro de la etapa forma_pago.

ALTER TABLE public.mnp_progreso_rematricula
  ADD COLUMN IF NOT EXISTS espera_cae boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS espera_ministerial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_progreso_rematricula.espera_cae IS
  'Bloqueo activo CAE: caso CAE_RESOLUCION abierto o verificación pendiente_resolucion.';
COMMENT ON COLUMN public.mnp_progreso_rematricula.espera_ministerial IS
  'Bloqueo activo Beca Ministerial: caso ESTATAL_MINEDUC abierto.';

CREATE OR REPLACE FUNCTION public.refresh_mnp_progreso_rematricula(p_anio integer, p_semestre integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_sync_exists boolean;
  v_sql text;
BEGIN
  -- Validar parámetros
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  -- Check if mv_matriculados_sync exists
  v_sync_exists := to_regclass('public.mv_matriculados_sync') IS NOT NULL;

  -- Conserva desde cuándo está cada alumno en su etapa actual.
  DROP TABLE IF EXISTS pg_temp.mnp_progreso_etapa_previa;
  CREATE TEMP TABLE mnp_progreso_etapa_previa ON COMMIT DROP AS
  SELECT codcli, etapa_actual, etapa_desde
  FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;

  -- Borrar datos existentes del periodo
  DELETE FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;

  -- Build dynamic SQL with conditional firma/matriculado checks
  v_sql := format($SQL$
  WITH cartera AS (
    SELECT rut_norm, rematriculable, excluido_mol
    FROM public.mnp_cartera_oficial
  ),
  consol AS (
    SELECT c.*,
      regexp_replace(
        upper(replace(replace(coalesce(c.rut_alumno,''),'.',''),'-','')),
        '[^0-9K]', '', 'g'
      ) AS rut_norm
    FROM public.mnp_mv_plan_pagos_consolidado c
  ),
  matched AS (
    SELECT
      consol.codcli,
      %L::integer AS anio_periodo,
      %L::integer AS semestre_periodo,
      consol.rut_alumno AS rut,
      cartera.rut_norm,
      trim(concat_ws(' ',
        consol.nombre_alumno,
        consol.apellido_paterno_alumno,
        consol.apellido_materno_alumno
      )) AS nombre_alumno,
      consol.codigo_carrera,
      consol.nombre_carrera,
      consol.jornada_carrera,
      cartera.excluido_mol,
      cartera.rematriculable,
      false AS sin_match_mol
    FROM cartera
    INNER JOIN consol ON consol.rut_norm = cartera.rut_norm
    WHERE consol.codcli IS NOT NULL AND length(trim(consol.codcli)) > 0
  ),
  sin_match AS (
    SELECT
      ('SIN_MATCH:' || cartera.rut_norm) AS codcli,
      %L::integer AS anio_periodo,
      %L::integer AS semestre_periodo,
      NULL::text AS rut,
      cartera.rut_norm,
      NULL::text AS nombre_alumno,
      NULL::text AS codigo_carrera,
      NULL::text AS nombre_carrera,
      NULL::text AS jornada_carrera,
      cartera.excluido_mol,
      cartera.rematriculable,
      true AS sin_match_mol
    FROM cartera
    WHERE NOT EXISTS (
      SELECT 1 FROM consol WHERE consol.rut_norm = cartera.rut_norm
    )
  ),
  universo AS (
    SELECT * FROM matched
    UNION ALL
    SELECT * FROM sin_match
  ),
  hitos AS (
    SELECT
      u.codcli,
      u.anio_periodo,
      u.semestre_periodo,
      u.rut,
      u.rut_norm,
      u.nombre_alumno,
      u.codigo_carrera,
      u.nombre_carrera,
      u.jornada_carrera,
      u.excluido_mol,
      u.rematriculable,
      u.sin_match_mol,
      CASE
        WHEN u.sin_match_mol THEN
          EXISTS (
            SELECT 1 FROM public.log_mol_evento e
            WHERE regexp_replace(upper(replace(replace(coalesce(e.rut_alumno,''),'.',''),'-','')), '[^0-9K]', '', 'g') = u.rut_norm
              AND e.anio_periodo = u.anio_periodo
              AND e.semestre_periodo = u.semestre_periodo
          )
          OR EXISTS (
            SELECT 1 FROM public.log_mol_tyc_respuesta t
            WHERE regexp_replace(upper(replace(replace(coalesce(t.rut_alumno,''),'.',''),'-','')), '[^0-9K]', '', 'g') = u.rut_norm
              AND t.anio_periodo = u.anio_periodo
              AND t.semestre_periodo = u.semestre_periodo
          )
          OR EXISTS (
            SELECT 1 FROM public.log_mol_contacto_otp o
            WHERE regexp_replace(upper(replace(replace(coalesce(o.rut_alumno,''),'.',''),'-','')), '[^0-9K]', '', 'g') = u.rut_norm
              AND o.anio_periodo = u.anio_periodo
              AND o.semestre_periodo = u.semestre_periodo
          )
        ELSE
          EXISTS (
            SELECT 1 FROM public.log_mol_evento e
            WHERE e.codcli = u.codcli
              AND e.anio_periodo = u.anio_periodo
              AND e.semestre_periodo = u.semestre_periodo
          )
          OR EXISTS (
            SELECT 1 FROM public.log_mol_tyc_respuesta t
            WHERE t.codcli = u.codcli
              AND t.anio_periodo = u.anio_periodo
              AND t.semestre_periodo = u.semestre_periodo
          )
          OR EXISTS (
            SELECT 1 FROM public.log_mol_contacto_otp o
            WHERE o.codcli = u.codcli
              AND o.anio_periodo = u.anio_periodo
              AND o.semestre_periodo = u.semestre_periodo
          )
      END AS tiene_ingreso,
      (
        SELECT t.accion = 'acepta'
        FROM public.log_mol_tyc_respuesta t
        WHERE t.codcli = u.codcli
          AND t.anio_periodo = u.anio_periodo
          AND t.semestre_periodo = u.semestre_periodo
        ORDER BY t.creado_en DESC
        LIMIT 1
      ) AS tyc_acepta,
      EXISTS (
        SELECT 1 FROM public.log_mol_contacto_otp o
        WHERE o.codcli = u.codcli
          AND o.anio_periodo = u.anio_periodo
          AND o.semestre_periodo = u.semestre_periodo
          AND o.evento = 'verificar_ok'
      )
      OR EXISTS (
        SELECT 1 FROM public.log_mol_evento e
        WHERE e.codcli = u.codcli
          AND e.anio_periodo = u.anio_periodo
          AND e.semestre_periodo = u.semestre_periodo
          AND e.categoria IN ('apoderado', 'discapacidad')
      ) AS datos_ok,
      EXISTS (
        SELECT 1 FROM public.log_mol_evento e
        WHERE e.codcli = u.codcli
          AND e.anio_periodo = u.anio_periodo
          AND e.semestre_periodo = u.semestre_periodo
          AND e.categoria IN ('forma_pago', 'plan_pago', 'plan_pagos')
      ) AS forma_pago_ok,
      %s AS firma_ok,
      %s AS matriculado_ok
    FROM universo u
  ),
  -- Flags de espera antes de etapa: standby CAE/Ministerial cuenta como forma_pago
  -- (el alumno ya entró al flujo de pago aunque no confirmó el medio).
  con_espera AS (
    SELECT
      h.*,
      (
        EXISTS (
          SELECT 1
          FROM public.mnp_caso_rematricula caso
          WHERE caso.codcli = h.codcli
            AND caso.periodo = (h.anio_periodo::text || '-0' || h.semestre_periodo::text)
            AND caso.tipo = 'CAE_RESOLUCION'
            AND caso.estado IN ('ABIERTO', 'EN_REVISION')
        )
        OR EXISTS (
          SELECT 1
          FROM public.mnp_verificacion_cae_mol v
          WHERE v.codcli = h.codcli
            AND v.anio_periodo = h.anio_periodo
            AND v.semestre_periodo = h.semestre_periodo
            AND v.resultado = 'pendiente_resolucion'
        )
      ) AS espera_cae,
      EXISTS (
        SELECT 1
        FROM public.mnp_caso_rematricula caso
        WHERE caso.codcli = h.codcli
          AND caso.periodo = (h.anio_periodo::text || '-0' || h.semestre_periodo::text)
          AND caso.tipo = 'ESTATAL_MINEDUC'
          AND caso.estado IN ('ABIERTO', 'EN_REVISION')
      ) AS espera_ministerial
    FROM hitos h
  ),
  con_etapa AS (
    SELECT
      ce.*,
      CASE
        WHEN ce.matriculado_ok THEN 'matriculado'
        WHEN ce.firma_ok THEN 'firma'
        WHEN ce.forma_pago_ok OR ce.espera_cae OR ce.espera_ministerial THEN 'forma_pago'
        WHEN ce.datos_ok THEN 'datos'
        WHEN ce.tyc_acepta THEN 'tyc'
        WHEN ce.tiene_ingreso THEN 'ingreso'
        ELSE 'sin_ingreso'
      END AS etapa_actual
    FROM con_espera ce
  ),
  ultima_actividad AS (
    SELECT
      ce.codcli,
      ce.anio_periodo,
      ce.semestre_periodo,
      (
        SELECT MAX(creado_en)
        FROM (
          SELECT e.creado_en
          FROM public.log_mol_evento e
          WHERE e.codcli = ce.codcli
            AND e.anio_periodo = ce.anio_periodo
            AND e.semestre_periodo = ce.semestre_periodo
          UNION ALL
          SELECT t.creado_en
          FROM public.log_mol_tyc_respuesta t
          WHERE t.codcli = ce.codcli
            AND t.anio_periodo = ce.anio_periodo
            AND t.semestre_periodo = ce.semestre_periodo
          UNION ALL
          SELECT o.creado_en
          FROM public.log_mol_contacto_otp o
          WHERE o.codcli = ce.codcli
            AND o.anio_periodo = ce.anio_periodo
            AND o.semestre_periodo = ce.semestre_periodo
        ) logs
      ) AS ultima_fecha,
      (
        WITH ultimos_logs AS (
          SELECT e.creado_en, e.categoria, e.accion
          FROM public.log_mol_evento e
          WHERE e.codcli = ce.codcli
            AND e.anio_periodo = ce.anio_periodo
            AND e.semestre_periodo = ce.semestre_periodo
          UNION ALL
          SELECT t.creado_en, 'tyc' AS categoria, t.accion
          FROM public.log_mol_tyc_respuesta t
          WHERE t.codcli = ce.codcli
            AND t.anio_periodo = ce.anio_periodo
            AND t.semestre_periodo = ce.semestre_periodo
          UNION ALL
          SELECT o.creado_en, 'contacto_otp' AS categoria, o.evento AS accion
          FROM public.log_mol_contacto_otp o
          WHERE o.codcli = ce.codcli
            AND o.anio_periodo = ce.anio_periodo
            AND o.semestre_periodo = ce.semestre_periodo
          ORDER BY creado_en DESC
          LIMIT 1
        )
        SELECT
          CASE
            WHEN lower(trim(categoria)) = 'tyc' AND lower(trim(accion)) = 'acepta' THEN 'Aceptó TyC'
            WHEN lower(trim(categoria)) = 'tyc' AND lower(trim(accion)) = 'rechaza' THEN 'Rechazó TyC'
            WHEN lower(trim(categoria)) = 'sesion' AND lower(trim(accion)) = 'inicio' THEN 'Inicio de sesión'
            WHEN lower(trim(categoria)) IN ('contacto', 'contacto_otp') AND lower(trim(accion)) = 'verificar_ok' THEN 'Verificó contacto'
            WHEN lower(trim(categoria)) IN ('contacto', 'contacto_otp') THEN 'Contacto OTP: ' || accion
            WHEN lower(trim(categoria)) = 'apoderado' AND lower(trim(accion)) = 'confirma_ok' THEN 'Confirmó datos del apoderado'
            WHEN lower(trim(categoria)) = 'apoderado' AND lower(trim(accion)) = 'confirma_desactualizado' THEN 'Marcó datos del apoderado como desactualizados'
            WHEN lower(trim(categoria)) = 'apoderado' THEN 'Apoderado: ' || accion
            WHEN lower(trim(categoria)) = 'discapacidad' AND lower(trim(accion)) = 'omitir' THEN 'Omitió discapacidad'
            WHEN lower(trim(categoria)) = 'discapacidad' THEN 'Discapacidad: ' || accion
            WHEN lower(trim(categoria)) = 'forma_pago' AND lower(trim(accion)) = 'confirmado' THEN 'Confirmó forma de pago'
            WHEN lower(trim(categoria)) = 'firma' AND lower(trim(accion)) = 'enviado' THEN 'Envió el contrato a firmar'
            WHEN lower(trim(categoria)) = 'firma' AND lower(trim(accion)) = 'firmado' THEN 'Contrato firmado'
            WHEN lower(trim(categoria)) = 'matricula' AND lower(trim(accion)) = 'matriculado' THEN 'Matrícula actualizada en U+'
            ELSE categoria || ': ' || accion
          END
        FROM ultimos_logs
      ) AS ultima_label
    FROM con_etapa ce
  )
  INSERT INTO public.mnp_progreso_rematricula (
    codcli, anio_periodo, semestre_periodo, rut, rut_norm,
    nombre_alumno, codigo_carrera, nombre_carrera, jornada_carrera,
    etapa_actual, etapa_desde, ultima_actividad_en, ultima_actividad_label,
    es_mock, excluido_mol, rematriculable, sin_match_mol,
    espera_cae, espera_ministerial, actualizado_en
  )
  SELECT
    ce.codcli,
    ce.anio_periodo,
    ce.semestre_periodo,
    ce.rut,
    ce.rut_norm,
    ce.nombre_alumno,
    ce.codigo_carrera,
    ce.nombre_carrera,
    ce.jornada_carrera,
    ce.etapa_actual,
    CASE
      WHEN prev.codcli IS NOT NULL AND prev.etapa_actual = ce.etapa_actual THEN prev.etapa_desde
      ELSE now()
    END AS etapa_desde,
    ua.ultima_fecha,
    ua.ultima_label,
    false AS es_mock,
    ce.excluido_mol,
    ce.rematriculable,
    ce.sin_match_mol,
    ce.espera_cae,
    ce.espera_ministerial,
    now() AS actualizado_en
  FROM con_etapa ce
  LEFT JOIN ultima_actividad ua ON ua.codcli = ce.codcli
    AND ua.anio_periodo = ce.anio_periodo
    AND ua.semestre_periodo = ce.semestre_periodo
  LEFT JOIN mnp_progreso_etapa_previa prev ON prev.codcli = ce.codcli
  $SQL$,
    p_anio,
    p_semestre,
    p_anio,
    p_semestre,
    CASE WHEN v_sync_exists THEN
      $firma$(
        EXISTS (
          SELECT 1 FROM public.mv_matriculados_sync m
          WHERE m.codcli = u.codcli
            AND m.ano_mat = u.anio_periodo
            AND m.periodo_mat = u.semestre_periodo
            AND m.estado_firma IS NOT NULL
            AND length(trim(coalesce(m.estado_firma, ''))) > 0
            AND upper(m.estado_firma) NOT LIKE '%PEND%'
        )
        OR EXISTS (
          SELECT 1 FROM public.log_mol_evento e
          WHERE e.codcli = u.codcli
            AND e.anio_periodo = u.anio_periodo
            AND e.semestre_periodo = u.semestre_periodo
            AND e.categoria = 'firma'
            AND e.accion = 'firmado'
        )
      )$firma$
    ELSE $firma$EXISTS (
      SELECT 1 FROM public.log_mol_evento e
      WHERE e.codcli = u.codcli
        AND e.anio_periodo = u.anio_periodo
        AND e.semestre_periodo = u.semestre_periodo
        AND e.categoria = 'firma'
        AND e.accion = 'firmado'
    )$firma$
    END,
    CASE WHEN v_sync_exists THEN
      $matric$(
        EXISTS (
          SELECT 1 FROM public.mv_matriculados_sync m
          WHERE m.codcli = u.codcli
            AND m.ano_mat = u.anio_periodo
            AND m.periodo_mat = u.semestre_periodo
        )
        OR EXISTS (
          SELECT 1 FROM public.log_mol_evento e
          WHERE e.codcli = u.codcli
            AND e.anio_periodo = u.anio_periodo
            AND e.semestre_periodo = u.semestre_periodo
            AND e.categoria = 'matricula'
            AND e.accion = 'matriculado'
        )
      )$matric$
    ELSE $matric$EXISTS (
      SELECT 1 FROM public.log_mol_evento e
      WHERE e.codcli = u.codcli
        AND e.anio_periodo = u.anio_periodo
        AND e.semestre_periodo = u.semestre_periodo
        AND e.categoria = 'matricula'
        AND e.accion = 'matriculado'
    )$matric$
    END
  );

  EXECUTE v_sql;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer);
DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer, text);

CREATE FUNCTION public.kpi_mnp_progreso_rematricula(
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
    (SELECT count(*) FILTER (WHERE etapa_actual = 'sin_ingreso')::integer FROM embudo) AS sin_ingreso,
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

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) IS
  'Agregados del embudo + desglose forma_pago espera CAE/Ministerial. Con p_email_ejecutivo, solo cartera de ese ejecutivo.';
