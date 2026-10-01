-- El embudo toma la firma desde el log del alumno, y la última actividad se lee en español.

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
  con_etapa AS (
    SELECT
      h.*,
      CASE
        WHEN h.matriculado_ok THEN 'matriculado'
        WHEN h.firma_ok THEN 'firma'
        WHEN h.forma_pago_ok THEN 'forma_pago'
        WHEN h.datos_ok THEN 'datos'
        WHEN h.tyc_acepta THEN 'tyc'
        WHEN h.tiene_ingreso THEN 'ingreso'
        ELSE 'sin_ingreso'
      END AS etapa_actual
    FROM hitos h
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
            ELSE categoria || ': ' || accion
          END
        FROM ultimos_logs
      ) AS ultima_label
    FROM con_etapa ce
  )
  INSERT INTO public.mnp_progreso_rematricula (
    codcli, anio_periodo, semestre_periodo, rut, rut_norm,
    nombre_alumno, codigo_carrera, nombre_carrera, jornada_carrera,
    etapa_actual, ultima_actividad_en, ultima_actividad_label,
    es_mock, excluido_mol, rematriculable, sin_match_mol, actualizado_en
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
    ua.ultima_fecha,
    ua.ultima_label,
    false AS es_mock,
    ce.excluido_mol,
    ce.rematriculable,
    ce.sin_match_mol,
    now() AS actualizado_en
  FROM con_etapa ce
  LEFT JOIN ultima_actividad ua ON ua.codcli = ce.codcli
    AND ua.anio_periodo = ce.anio_periodo
    AND ua.semestre_periodo = ce.semestre_periodo
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
      $matric$EXISTS (
        SELECT 1 FROM public.mv_matriculados_sync m
        WHERE m.codcli = u.codcli
          AND m.ano_mat = u.anio_periodo
          AND m.periodo_mat = u.semestre_periodo
      )$matric$
    ELSE 'false'
    END
  );

  EXECUTE v_sql;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$

;
