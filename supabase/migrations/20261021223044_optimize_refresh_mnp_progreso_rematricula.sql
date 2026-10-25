-- Evita búsquedas correlacionadas por cada alumno durante el refresco del KPI.
-- La RPC conserva su firma y resultado; los logs del periodo se agregan una sola vez.

CREATE INDEX IF NOT EXISTS idx_log_mol_evento_periodo_alumno_fecha
  ON public.log_mol_evento (anio_periodo, semestre_periodo, codcli, creado_en DESC)
  INCLUDE (categoria, accion, rut_alumno);

CREATE INDEX IF NOT EXISTS idx_log_mol_tyc_periodo_alumno_fecha
  ON public.log_mol_tyc_respuesta (anio_periodo, semestre_periodo, codcli, creado_en DESC)
  INCLUDE (accion, rut_alumno);

CREATE INDEX IF NOT EXISTS idx_log_mol_otp_periodo_alumno_fecha
  ON public.log_mol_contacto_otp (anio_periodo, semestre_periodo, codcli, creado_en DESC)
  INCLUDE (evento, rut_alumno);

CREATE OR REPLACE FUNCTION public.refresh_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer;
  v_sync_exists boolean;
BEGIN
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  -- Un refresco por periodo a la vez: protege el ciclo DELETE + INSERT.
  PERFORM pg_advisory_xact_lock(20261021, p_anio * 10 + p_semestre);

  v_sync_exists := to_regclass('public.mv_matriculados_sync') IS NOT NULL;

  DROP TABLE IF EXISTS pg_temp.mnp_progreso_etapa_previa;
  CREATE TEMP TABLE mnp_progreso_etapa_previa ON COMMIT DROP AS
  SELECT codcli, etapa_actual, etapa_desde
  FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre;
  CREATE UNIQUE INDEX ON mnp_progreso_etapa_previa (codcli);

  -- Uniforma la rama opcional de mv_matriculados_sync para que el INSERT principal sea estático.
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
  -- Una fila por RUT y carrera. Si hay dos códigos de la misma carrera, queda el vigente.
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
  logs_periodo AS MATERIALIZED (
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
  actividad_rut AS (
    SELECT rut_norm, true AS tiene_ingreso
    FROM logs_periodo
    WHERE rut_norm <> ''
    GROUP BY rut_norm
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
  hitos AS (
    SELECT
      u.*,
      CASE
        WHEN u.sin_match_mol THEN coalesce(ar.tiene_ingreso, false)
        ELSE coalesce(ac.tiene_ingreso, false)
      END AS tiene_ingreso,
      ut.tyc_acepta,
      coalesce(ac.datos_ok, false) AS datos_ok,
      coalesce(ac.forma_pago_ok, false) AS forma_pago_ok,
      coalesce(ms.firma_ok, false) OR coalesce(ac.firma_ok, false) AS firma_ok,
      coalesce(ms.matriculado_ok, false) OR coalesce(ac.matriculado_ok, false) AS matriculado_ok,
      coalesce(cp.espera_cae, false) OR coalesce(cae.espera_cae, false) AS espera_cae,
      coalesce(cp.espera_ministerial, false) AS espera_ministerial
    FROM universo u
    LEFT JOIN actividad_codcli ac ON ac.codcli = u.codcli
    LEFT JOIN actividad_rut ar ON ar.rut_norm = u.rut_norm
    LEFT JOIN ultima_tyc ut ON ut.codcli = u.codcli
    LEFT JOIN mnp_progreso_sync ms ON ms.codcli = u.codcli
    LEFT JOIN casos_periodo cp ON cp.codcli = u.codcli
    LEFT JOIN cae_pendiente cae ON cae.codcli = u.codcli
  ),
  con_etapa AS (
    SELECT
      h.*,
      CASE
        WHEN h.matriculado_ok THEN 'matriculado'
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
    codcli,
    anio_periodo,
    semestre_periodo,
    rut,
    rut_norm,
    nombre_alumno,
    codigo_carrera,
    nombre_carrera,
    jornada_carrera,
    etapa_actual,
    etapa_desde,
    ultima_actividad_en,
    ultima_actividad_label,
    es_mock,
    excluido_mol,
    rematriculable,
    sin_match_mol,
    espera_cae,
    espera_ministerial,
    actualizado_en
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
      WHEN prev.codcli IS NOT NULL
        AND prev.etapa_actual = ce.etapa_actual
      THEN prev.etapa_desde
      ELSE now()
    END AS etapa_desde,
    ul.creado_en AS ultima_actividad_en,
    CASE
      WHEN lower(trim(ul.categoria)) = 'tyc'
        AND lower(trim(ul.accion)) = 'acepta'
        THEN 'Aceptó TyC'
      WHEN lower(trim(ul.categoria)) = 'tyc'
        AND lower(trim(ul.accion)) = 'rechaza'
        THEN 'Rechazó TyC'
      WHEN lower(trim(ul.categoria)) = 'sesion'
        AND lower(trim(ul.accion)) = 'inicio'
        THEN 'Inicio de sesión'
      WHEN lower(trim(ul.categoria)) IN ('contacto', 'contacto_otp')
        AND lower(trim(ul.accion)) = 'verificar_ok'
        THEN 'Verificó contacto'
      WHEN lower(trim(ul.categoria)) IN ('contacto', 'contacto_otp')
        THEN 'Contacto OTP: ' || ul.accion
      WHEN lower(trim(ul.categoria)) = 'apoderado'
        AND lower(trim(ul.accion)) = 'confirma_ok'
        THEN 'Confirmó datos del apoderado'
      WHEN lower(trim(ul.categoria)) = 'apoderado'
        AND lower(trim(ul.accion)) = 'confirma_desactualizado'
        THEN 'Marcó datos del apoderado como desactualizados'
      WHEN lower(trim(ul.categoria)) = 'apoderado'
        THEN 'Apoderado: ' || ul.accion
      WHEN lower(trim(ul.categoria)) = 'discapacidad'
        AND lower(trim(ul.accion)) = 'omitir'
        THEN 'Omitió discapacidad'
      WHEN lower(trim(ul.categoria)) = 'discapacidad'
        THEN 'Discapacidad: ' || ul.accion
      WHEN lower(trim(ul.categoria)) = 'forma_pago'
        AND lower(trim(ul.accion)) = 'confirmado'
        THEN 'Confirmó forma de pago'
      WHEN lower(trim(ul.categoria)) = 'firma'
        AND lower(trim(ul.accion)) = 'enviado'
        THEN 'Envió el contrato a firmar'
      WHEN lower(trim(ul.categoria)) = 'firma'
        AND lower(trim(ul.accion)) = 'firmado'
        THEN 'Contrato firmado'
      WHEN lower(trim(ul.categoria)) = 'matricula'
        AND lower(trim(ul.accion)) = 'matriculado'
        THEN 'Matrícula actualizada en U+'
      WHEN ul.categoria IS NOT NULL
        THEN ul.categoria || ': ' || ul.accion
      ELSE NULL
    END AS ultima_actividad_label,
    false AS es_mock,
    ce.excluido_mol,
    ce.rematriculable,
    ce.sin_match_mol,
    ce.espera_cae,
    ce.espera_ministerial,
    now() AS actualizado_en
  FROM con_etapa ce
  LEFT JOIN ultimo_log ul ON ul.codcli = ce.codcli
  LEFT JOIN mnp_progreso_etapa_previa prev ON prev.codcli = ce.codcli;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
