-- Mueve forma_pago Webpay/borrador a la preagregación; el RPC del KPI deja el join O(n×m).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.refresh_mnp_progreso_actividad_periodo(
  p_anio integer,
  p_semestre integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  PERFORM pg_advisory_xact_lock(20261126, p_anio * 10 + p_semestre);

  DELETE FROM public.mnp_progreso_actividad_periodo
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre;

  WITH
  logs_periodo AS (
    SELECT
      e.codcli,
      regexp_replace(
        upper(replace(replace(coalesce(e.rut_alumno, ''), '.', ''), '-', '')),
        '[^0-9K]', '', 'g'
      ) AS rut_norm,
      e.creado_en,
      e.categoria,
      e.accion
    FROM public.log_mol_evento e
    WHERE e.anio_periodo = p_anio
      AND e.semestre_periodo = p_semestre

    UNION ALL

    SELECT
      t.codcli,
      regexp_replace(
        upper(replace(replace(coalesce(t.rut_alumno, ''), '.', ''), '-', '')),
        '[^0-9K]', '', 'g'
      ) AS rut_norm,
      t.creado_en,
      'tyc'::text AS categoria,
      t.accion
    FROM public.log_mol_tyc_respuesta t
    WHERE t.anio_periodo = p_anio
      AND t.semestre_periodo = p_semestre

    UNION ALL

    SELECT
      o.codcli,
      regexp_replace(
        upper(replace(replace(coalesce(o.rut_alumno, ''), '.', ''), '-', '')),
        '[^0-9K]', '', 'g'
      ) AS rut_norm,
      o.creado_en,
      'contacto_otp'::text AS categoria,
      o.evento AS accion
    FROM public.log_mol_contacto_otp o
    WHERE o.anio_periodo = p_anio
      AND o.semestre_periodo = p_semestre
  ),
  actividad_codcli AS (
    SELECT
      codcli,
      max(nullif(rut_norm, '')) AS rut_norm,
      true AS tiene_ingreso,
      bool_or(
        (categoria = 'contacto_otp' AND accion = 'verificar_ok')
        OR categoria IN ('apoderado', 'discapacidad')
      ) AS datos_ok,
      bool_or(categoria IN ('forma_pago', 'plan_pago', 'plan_pagos')) AS forma_pago_ok,
      bool_or(categoria = 'firma' AND accion = 'firmado') AS firma_ok,
      bool_or(categoria = 'matricula' AND accion = 'matriculado') AS matriculado_ok
    FROM logs_periodo
    WHERE codcli IS NOT NULL
    GROUP BY codcli
  ),
  ultimo_log AS (
    SELECT DISTINCT ON (l.codcli)
      l.codcli,
      l.creado_en,
      l.categoria,
      l.accion
    FROM logs_periodo l
    WHERE l.codcli IS NOT NULL
    ORDER BY l.codcli, l.creado_en DESC
  ),
  ultima_tyc AS (
    SELECT DISTINCT ON (t.codcli)
      t.codcli,
      t.accion = 'acepta' AS tyc_acepta
    FROM public.log_mol_tyc_respuesta t
    WHERE t.anio_periodo = p_anio
      AND t.semestre_periodo = p_semestre
      AND t.codcli IS NOT NULL
    ORDER BY t.codcli, t.creado_en DESC
  ),
  actividad_rut AS (
    SELECT rut_norm, true AS tiene_ingreso
    FROM logs_periodo
    WHERE rut_norm <> ''
    GROUP BY rut_norm
  ),
  filas AS (
    SELECT
      ac.codcli,
      p_anio AS anio_periodo,
      p_semestre::smallint AS semestre_periodo,
      ac.rut_norm,
      ac.tiene_ingreso,
      ac.datos_ok,
      ac.forma_pago_ok,
      ac.firma_ok,
      ac.matriculado_ok,
      ut.tyc_acepta,
      ul.creado_en AS ultima_actividad_en,
      ul.categoria AS ultima_categoria,
      ul.accion AS ultima_accion,
      now() AS actualizado_en
    FROM actividad_codcli ac
    LEFT JOIN ultimo_log ul ON ul.codcli = ac.codcli
    LEFT JOIN ultima_tyc ut ON ut.codcli = ac.codcli

    UNION ALL

    SELECT
      'SIN_MATCH:' || ar.rut_norm AS codcli,
      p_anio,
      p_semestre::smallint,
      ar.rut_norm,
      true,
      false,
      false,
      false,
      false,
      NULL::boolean,
      NULL::timestamptz,
      NULL::text,
      NULL::text,
      now()
    FROM actividad_rut ar
  )
  INSERT INTO public.mnp_progreso_actividad_periodo (
    codcli, anio_periodo, semestre_periodo, rut_norm,
    tiene_ingreso, datos_ok, forma_pago_ok, firma_ok, matriculado_ok,
    tyc_acepta, ultima_actividad_en, ultima_categoria, ultima_accion, actualizado_en
  )
  SELECT * FROM filas;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Webpay matrícula autorizada → forma_pago_ok (match exacto por codcli).
  UPDATE public.mnp_progreso_actividad_periodo a
  SET forma_pago_ok = true
  FROM public.mnp_webpay_transaccion w
  WHERE a.anio_periodo = p_anio
    AND a.semestre_periodo = p_semestre
    AND NOT a.forma_pago_ok
    AND w.anio_periodo = p_anio
    AND w.semestre_periodo = p_semestre
    AND w.concepto = 'matricula'
    AND w.estado = 'autorizada'
    AND w.codcli = a.codcli;

  -- Webpay: buy_order con prefijo RUT-sin-DV + periodo.
  UPDATE public.mnp_progreso_actividad_periodo a
  SET forma_pago_ok = true
  FROM public.mnp_webpay_transaccion w
  WHERE a.anio_periodo = p_anio
    AND a.semestre_periodo = p_semestre
    AND NOT a.forma_pago_ok
    AND a.rut_norm IS NOT NULL
    AND length(a.rut_norm) > 1
    AND w.anio_periodo = p_anio
    AND w.semestre_periodo = p_semestre
    AND w.concepto = 'matricula'
    AND w.estado = 'autorizada'
    AND starts_with(
      w.buy_order,
      left(a.rut_norm, length(a.rut_norm) - 1) || p_anio::text || '-' || p_semestre::text || '-'
    );

  -- Webpay: codcli con forma RUT (normalizado) igual al rut_norm del alumno.
  UPDATE public.mnp_progreso_actividad_periodo a
  SET forma_pago_ok = true
  FROM public.mnp_webpay_transaccion w
  WHERE a.anio_periodo = p_anio
    AND a.semestre_periodo = p_semestre
    AND NOT a.forma_pago_ok
    AND a.rut_norm IS NOT NULL
    AND length(a.rut_norm) > 1
    AND w.anio_periodo = p_anio
    AND w.semestre_periodo = p_semestre
    AND w.concepto = 'matricula'
    AND w.estado = 'autorizada'
    AND upper(trim(coalesce(w.codcli, ''))) ~ '^[0-9][0-9.]*-?[0-9K]$'
    AND regexp_replace(upper(coalesce(w.codcli, '')), '[^0-9K]', '', 'g')
      IN (a.rut_norm, left(a.rut_norm, length(a.rut_norm) - 1));

  -- Borrador con medio pagaré/webpay.
  UPDATE public.mnp_progreso_actividad_periodo a
  SET forma_pago_ok = true
  FROM public.mol_borrador_rematricula b
  WHERE a.anio_periodo = p_anio
    AND a.semestre_periodo = p_semestre
    AND NOT a.forma_pago_ok
    AND b.anio_periodo = p_anio
    AND b.semestre_periodo = p_semestre
    AND b.codcli = a.codcli
    AND (
      lower(coalesce(b.payload->>'webpayMatriculaEstado', '')) = 'autorizada'
      OR lower(trim(coalesce(b.payload->>'medioMatricula', ''))) IN ('webpay', 'pagare')
      OR lower(trim(coalesce(b.payload->>'medioArancel', ''))) IN ('webpay', 'pagare')
    );

  -- Alumnos solo en Webpay/borrador sin logs: insertar fila mínima.
  INSERT INTO public.mnp_progreso_actividad_periodo (
    codcli, anio_periodo, semestre_periodo, rut_norm,
    tiene_ingreso, datos_ok, forma_pago_ok, firma_ok, matriculado_ok,
    tyc_acepta, ultima_actividad_en, ultima_categoria, ultima_accion, actualizado_en
  )
  SELECT DISTINCT
    b.codcli,
    p_anio,
    p_semestre::smallint,
    NULL::text,
    false,
    false,
    true,
    false,
    false,
    NULL::boolean,
    NULL::timestamptz,
    NULL::text,
    NULL::text,
    now()
  FROM public.mol_borrador_rematricula b
  WHERE b.anio_periodo = p_anio
    AND b.semestre_periodo = p_semestre
    AND b.codcli IS NOT NULL
    AND (
      lower(coalesce(b.payload->>'webpayMatriculaEstado', '')) = 'autorizada'
      OR lower(trim(coalesce(b.payload->>'medioMatricula', ''))) IN ('webpay', 'pagare')
      OR lower(trim(coalesce(b.payload->>'medioArancel', ''))) IN ('webpay', 'pagare')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.mnp_progreso_actividad_periodo a
      WHERE a.codcli = b.codcli AND a.anio_periodo = p_anio AND a.semestre_periodo = p_semestre
    );

  INSERT INTO public.mnp_progreso_actividad_periodo (
    codcli, anio_periodo, semestre_periodo, rut_norm,
    tiene_ingreso, datos_ok, forma_pago_ok, firma_ok, matriculado_ok,
    tyc_acepta, ultima_actividad_en, ultima_categoria, ultima_accion, actualizado_en
  )
  SELECT DISTINCT
    w.codcli,
    p_anio,
    p_semestre::smallint,
    NULL::text,
    false,
    false,
    true,
    false,
    false,
    NULL::boolean,
    NULL::timestamptz,
    NULL::text,
    NULL::text,
    now()
  FROM public.mnp_webpay_transaccion w
  WHERE w.anio_periodo = p_anio
    AND w.semestre_periodo = p_semestre
    AND w.concepto = 'matricula'
    AND w.estado = 'autorizada'
    AND w.codcli IS NOT NULL
    AND btrim(w.codcli) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.mnp_progreso_actividad_periodo a
      WHERE a.codcli = w.codcli AND a.anio_periodo = p_anio AND a.semestre_periodo = p_semestre
    );

  RETURN v_count;
END;
$function$;

-- Quitar CTEs webpay/borrador del refresh de progreso: forma_pago_ok ya viene preagregada.
CREATE OR REPLACE FUNCTION public.refresh_mnp_progreso_rematricula(p_anio integer, p_semestre integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_sync_exists boolean;
  v_fresco boolean;
  v_act_count integer;
  v_act_max timestamptz;
BEGIN
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  PERFORM pg_advisory_xact_lock(20261021, p_anio * 10 + p_semestre);

  SELECT count(*), bool_and(coalesce(actualizado_en > clock_timestamp() - interval '60 seconds', false))
    INTO v_count, v_fresco
    FROM public.mnp_progreso_rematricula
   WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;
  IF v_count > 0 AND coalesce(v_fresco, false) THEN
    RETURN v_count;
  END IF;

  SELECT count(*), max(actualizado_en)
    INTO v_act_count, v_act_max
    FROM public.mnp_progreso_actividad_periodo
   WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;
  IF coalesce(v_act_count, 0) = 0
     OR v_act_max IS NULL
     OR v_act_max < clock_timestamp() - interval '15 minutes' THEN
    PERFORM public.refresh_mnp_progreso_actividad_periodo(p_anio, p_semestre);
  END IF;

  v_sync_exists := to_regclass('public.mv_matriculados_sync') IS NOT NULL;

  DROP TABLE IF EXISTS pg_temp.mnp_progreso_etapa_previa;
  CREATE TEMP TABLE mnp_progreso_etapa_previa ON COMMIT DROP AS
  SELECT codcli, etapa_actual, etapa_desde
  FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre;
  CREATE UNIQUE INDEX ON mnp_progreso_etapa_previa (codcli);

  DROP TABLE IF EXISTS pg_temp.mnp_progreso_sync;
  CREATE TEMP TABLE mnp_progreso_sync (
    codcli text PRIMARY KEY,
    firma_ok boolean NOT NULL,
    matriculado_ok boolean NOT NULL
  ) ON COMMIT DROP;

  IF v_sync_exists THEN
    EXECUTE $sql$
      INSERT INTO mnp_progreso_sync (codcli, firma_ok, matriculado_ok)
      SELECT
        codcli,
        bool_or(
          estado_firma IS NOT NULL
          AND length(trim(coalesce(estado_firma, ''))) > 0
          AND upper(estado_firma) NOT LIKE '%PEND%'
        ) AS firma_ok,
        true AS matriculado_ok
      FROM public.mv_matriculados_sync
      WHERE ano_mat = $1
        AND periodo_mat = $2
      GROUP BY codcli
    $sql$ USING p_anio, p_semestre;
  END IF;

  DELETE FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre;

  WITH
  cartera AS MATERIALIZED (
    SELECT rut_norm, rematriculable, excluido_mol
    FROM public.mnp_cartera_oficial
  ),
  consol AS MATERIALIZED (
    SELECT
      c.*,
      regexp_replace(
        upper(replace(replace(coalesce(c.rut_alumno, ''), '.', ''), '-', '')),
        '[^0-9K]', '', 'g'
      ) AS rut_norm
    FROM public.mnp_mv_plan_pagos_consolidado c
  ),
  consol_ruts AS MATERIALIZED (
    SELECT DISTINCT rut_norm
    FROM consol
  ),
  matched AS (
    SELECT DISTINCT ON (ca.rut_norm, coalesce(nullif(btrim(c.codigo_carrera), ''), c.codcli))
      c.codcli,
      p_anio AS anio_periodo,
      p_semestre AS semestre_periodo,
      c.rut_alumno AS rut,
      ca.rut_norm,
      trim(concat_ws(
        ' ',
        c.nombre_alumno,
        c.apellido_paterno_alumno,
        c.apellido_materno_alumno
      )) AS nombre_alumno,
      c.codigo_carrera,
      c.nombre_carrera,
      c.jornada_carrera,
      ca.excluido_mol,
      ca.rematriculable,
      false AS sin_match_mol
    FROM cartera ca
    INNER JOIN consol c ON c.rut_norm = ca.rut_norm
    WHERE c.codcli IS NOT NULL
      AND length(trim(c.codcli)) > 0
    ORDER BY
      ca.rut_norm,
      coalesce(nullif(btrim(c.codigo_carrera), ''), c.codcli),
      CASE
        WHEN upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE' THEN 0
        ELSE 1
      END,
      c.codcli DESC
  ),
  sin_match AS (
    SELECT
      'SIN_MATCH:' || ca.rut_norm AS codcli,
      p_anio AS anio_periodo,
      p_semestre AS semestre_periodo,
      NULL::text AS rut,
      ca.rut_norm,
      NULL::text AS nombre_alumno,
      NULL::text AS codigo_carrera,
      NULL::text AS nombre_carrera,
      NULL::text AS jornada_carrera,
      ca.excluido_mol,
      ca.rematriculable,
      true AS sin_match_mol
    FROM cartera ca
    LEFT JOIN consol_ruts cr ON cr.rut_norm = ca.rut_norm
    WHERE cr.rut_norm IS NULL
  ),
  universo AS MATERIALIZED (
    SELECT * FROM matched
    UNION ALL
    SELECT * FROM sin_match
  ),
  casos_periodo AS (
    SELECT
      c.codcli,
      bool_or(c.tipo = 'CAE_RESOLUCION') AS espera_cae,
      bool_or(c.tipo = 'ESTATAL_MINEDUC') AS espera_ministerial
    FROM public.mnp_caso_rematricula c
    WHERE c.periodo = p_anio::text || '-0' || p_semestre::text
      AND c.estado IN ('ABIERTO', 'EN_REVISION')
      AND c.tipo IN ('CAE_RESOLUCION', 'ESTATAL_MINEDUC')
    GROUP BY c.codcli
  ),
  cae_pendiente AS (
    SELECT v.codcli, true AS espera_cae
    FROM public.mnp_verificacion_cae_mol v
    WHERE v.anio_periodo = p_anio
      AND v.semestre_periodo = p_semestre
      AND v.resultado = 'pendiente_resolucion'
    GROUP BY v.codcli
  ),
  cartera_consol_txt AS (
    SELECT DISTINCT ON (rut_norm)
      rut_norm,
      consolidado
    FROM public.mnp_cartera_consolidado
    ORDER BY
      rut_norm,
      CASE
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%CAE%/%BECA%' THEN 0
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%BECA%' THEN 1
        WHEN upper(trim(coalesce(consolidado, ''))) LIKE '%CAE%' THEN 2
        ELSE 3
      END
  ),
  hitos AS (
    SELECT
      u.*,
      coalesce(act.tiene_ingreso, false) AS tiene_ingreso,
      act.tyc_acepta,
      coalesce(act.datos_ok, false) AS datos_ok,
      coalesce(act.forma_pago_ok, false) AS forma_pago_ok,
      coalesce(ms.firma_ok, false) OR coalesce(act.firma_ok, false) AS firma_ok,
      coalesce(ms.matriculado_ok, false) OR coalesce(act.matriculado_ok, false) AS matriculado_ok,
      EXISTS (
        SELECT 1
        FROM public.mnp_matricula_cartera_canal b
        WHERE b.anio_periodo = p_anio
          AND b.semestre_periodo = p_semestre
          AND b.canal = 'BO'
          AND (
            b.codcli = u.codcli
            OR (
              u.rut_norm IS NOT NULL
              AND btrim(u.rut_norm) <> ''
              AND b.rut_norm = u.rut_norm
            )
          )
      ) AS matriculado_bo_ok,
      coalesce(cp.espera_cae, false) OR coalesce(cae.espera_cae, false) AS espera_cae,
      coalesce(cp.espera_ministerial, false)
        OR (
          (coalesce(cp.espera_cae, false) OR coalesce(cae.espera_cae, false))
          AND upper(trim(coalesce(cct.consolidado, ''))) LIKE '%CAE%/%BECA%'
        ) AS espera_ministerial,
      act.ultima_actividad_en,
      act.ultima_categoria,
      act.ultima_accion
    FROM universo u
    LEFT JOIN public.mnp_progreso_actividad_periodo act
      ON act.codcli = u.codcli
     AND act.anio_periodo = p_anio
     AND act.semestre_periodo = p_semestre
    LEFT JOIN mnp_progreso_sync ms ON ms.codcli = u.codcli
    LEFT JOIN casos_periodo cp ON cp.codcli = u.codcli
    LEFT JOIN cae_pendiente cae ON cae.codcli = u.codcli
    LEFT JOIN cartera_consol_txt cct ON cct.rut_norm = u.rut_norm
  ),
  con_etapa AS (
    SELECT
      h.*,
      CASE
        WHEN h.matriculado_ok AND h.matriculado_bo_ok THEN 'conflicto_mol_bo'
        WHEN h.matriculado_ok THEN 'matriculado'
        WHEN h.matriculado_bo_ok THEN 'matriculado_bo'
        WHEN h.firma_ok THEN 'firma'
        WHEN h.forma_pago_ok OR h.espera_cae OR h.espera_ministerial THEN 'forma_pago'
        WHEN h.datos_ok THEN 'datos'
        WHEN h.tyc_acepta THEN 'tyc'
        WHEN h.tiene_ingreso THEN 'ingreso'
        ELSE 'sin_ingreso'
      END AS etapa_actual
    FROM hitos h
  )
  INSERT INTO public.mnp_progreso_rematricula (
    codcli, anio_periodo, semestre_periodo, rut, rut_norm, nombre_alumno,
    codigo_carrera, nombre_carrera, jornada_carrera, etapa_actual, etapa_desde,
    ultima_actividad_en, ultima_actividad_label, es_mock, excluido_mol,
    rematriculable, sin_match_mol, espera_cae, espera_ministerial, actualizado_en
  )
  SELECT
    ce.codcli, ce.anio_periodo, ce.semestre_periodo, ce.rut, ce.rut_norm, ce.nombre_alumno,
    ce.codigo_carrera, ce.nombre_carrera, ce.jornada_carrera, ce.etapa_actual,
    CASE
      WHEN prev.codcli IS NOT NULL AND prev.etapa_actual = ce.etapa_actual
      THEN prev.etapa_desde ELSE now()
    END,
    ce.ultima_actividad_en,
    CASE
      WHEN lower(trim(ce.ultima_categoria)) = 'tyc' AND lower(trim(ce.ultima_accion)) = 'acepta' THEN 'Aceptó TyC'
      WHEN lower(trim(ce.ultima_categoria)) = 'tyc' AND lower(trim(ce.ultima_accion)) = 'rechaza' THEN 'Rechazó TyC'
      WHEN lower(trim(ce.ultima_categoria)) = 'sesion' AND lower(trim(ce.ultima_accion)) = 'inicio' THEN 'Inicio de sesión'
      WHEN lower(trim(ce.ultima_categoria)) IN ('contacto', 'contacto_otp') AND lower(trim(ce.ultima_accion)) = 'verificar_ok' THEN 'Verificó contacto'
      WHEN lower(trim(ce.ultima_categoria)) IN ('contacto', 'contacto_otp') THEN 'Contacto OTP: ' || ce.ultima_accion
      WHEN lower(trim(ce.ultima_categoria)) = 'apoderado' AND lower(trim(ce.ultima_accion)) = 'confirma_ok' THEN 'Confirmó datos del apoderado'
      WHEN lower(trim(ce.ultima_categoria)) = 'apoderado' AND lower(trim(ce.ultima_accion)) = 'confirma_desactualizado' THEN 'Marcó datos del apoderado como desactualizados'
      WHEN lower(trim(ce.ultima_categoria)) = 'apoderado' THEN 'Apoderado: ' || ce.ultima_accion
      WHEN lower(trim(ce.ultima_categoria)) = 'discapacidad' AND lower(trim(ce.ultima_accion)) = 'omitir' THEN 'Omitió discapacidad'
      WHEN lower(trim(ce.ultima_categoria)) = 'discapacidad' THEN 'Discapacidad: ' || ce.ultima_accion
      WHEN lower(trim(ce.ultima_categoria)) = 'forma_pago' AND lower(trim(ce.ultima_accion)) = 'confirmado' THEN 'Confirmó forma de pago'
      WHEN lower(trim(ce.ultima_categoria)) = 'firma' AND lower(trim(ce.ultima_accion)) = 'enviado' THEN 'Envió el contrato a firmar'
      WHEN lower(trim(ce.ultima_categoria)) = 'firma' AND lower(trim(ce.ultima_accion)) = 'firmado' THEN 'Contrato firmado'
      WHEN lower(trim(ce.ultima_categoria)) = 'matricula' AND lower(trim(ce.ultima_accion)) = 'matriculado' THEN 'Matrícula actualizada en U+'
      WHEN ce.ultima_categoria IS NOT NULL THEN ce.ultima_categoria || ': ' || ce.ultima_accion
      ELSE NULL
    END,
    false, ce.excluido_mol, ce.rematriculable, ce.sin_match_mol, ce.espera_cae, ce.espera_ministerial, now()
  FROM con_etapa ce
  LEFT JOIN mnp_progreso_etapa_previa prev ON prev.codcli = ce.codcli;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.mnp_seguimiento_matricula_hito
    (codcli,anio_periodo,semestre_periodo,autor_email,etapa_previa,es_linea_base)
  SELECT p.codcli,p.anio_periodo,p.semestre_periodo,a.autor_email,prev.etapa_actual,prev.codcli IS NULL
  FROM public.mnp_progreso_rematricula p
  LEFT JOIN pg_temp.mnp_progreso_etapa_previa prev ON prev.codcli=p.codcli
  LEFT JOIN LATERAL (
    SELECT lower(btrim(c.autor_email)) AS autor_email FROM public.mnp_seguimiento_contacto c
    WHERE c.codcli=p.codcli AND c.anio_periodo=p.anio_periodo AND c.semestre_periodo=p.semestre_periodo
      AND c.origen='manual' AND coalesce(c.fecha_contacto,c.created_at)<=clock_timestamp()
    ORDER BY coalesce(c.fecha_contacto,c.created_at) DESC,c.created_at DESC,c.id DESC LIMIT 1
  ) a ON true
  WHERE p.anio_periodo=p_anio AND p.semestre_periodo=p_semestre AND p.etapa_actual='matriculado'
    AND (prev.codcli IS NULL OR prev.etapa_actual IS DISTINCT FROM 'matriculado')
  ON CONFLICT(codcli,anio_periodo,semestre_periodo) DO NOTHING;

  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.refresh_mnp_progreso_actividad_periodo(integer, integer) IS
  'Preagrega logs + Webpay/borrador (forma_pago_ok) por periodo.';
COMMENT ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer) IS
  'Recalcula progreso desde mnp_progreso_actividad_periodo (sin join Webpay O(n×m)).';

GRANT EXECUTE ON FUNCTION public.refresh_mnp_progreso_actividad_periodo(integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer) TO anon, authenticated, service_role;

COMMIT;
