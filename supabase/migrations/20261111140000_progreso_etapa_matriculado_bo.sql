BEGIN;
SET LOCAL lock_timeout='5s';

-- Etapa terminal matriculado_bo (BackOffice) y alerta conflicto_mol_bo si el alumno figura en MOL y BO.
ALTER TABLE public.mnp_progreso_rematricula
  DROP CONSTRAINT IF EXISTS mnp_progreso_etapa_chk;
ALTER TABLE public.mnp_progreso_rematricula
  ADD CONSTRAINT mnp_progreso_etapa_chk CHECK (etapa_actual = ANY (ARRAY[
    'sin_ingreso'::text, 'ingreso'::text, 'tyc'::text, 'datos'::text,
    'forma_pago'::text, 'firma'::text, 'matriculado'::text,
    'matriculado_bo'::text, 'conflicto_mol_bo'::text
  ]));

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
BEGIN
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  -- Un refresco por periodo a la vez: protege el ciclo DELETE + INSERT.
  PERFORM pg_advisory_xact_lock(20261021, p_anio * 10 + p_semestre);

  -- TTL global bajo el mismo lock: varias sesiones/filtros no recalculan el período.
  SELECT count(*), bool_and(coalesce(actualizado_en > clock_timestamp() - interval '60 seconds', false))
    INTO v_count, v_fresco
    FROM public.mnp_progreso_rematricula
   WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;
  IF v_count > 0 AND coalesce(v_fresco, false) THEN
    RETURN v_count;
  END IF;

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
  -- Texto Excel CAE / BECA MINISTERIAL / CAE/BECA MINISTERIAL por RUT.
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

  webpay_matricula_ok AS (
    SELECT DISTINCT u.codcli
    FROM universo u
    INNER JOIN public.mnp_webpay_transaccion w
      ON w.anio_periodo = p_anio
     AND w.semestre_periodo = p_semestre
     AND w.concepto = 'matricula'
     AND w.estado = 'autorizada'
     AND (
       w.codcli = u.codcli
       OR (
         length(u.rut_norm) > 1
         AND (
           (
             upper(trim(coalesce(w.codcli, ''))) ~ '^[0-9][0-9.]*-?[0-9K]$'
             AND regexp_replace(upper(coalesce(w.codcli, '')), '[^0-9K]', '', 'g')
               IN (u.rut_norm, left(u.rut_norm, length(u.rut_norm) - 1))
           )
           OR starts_with(w.buy_order,
             left(u.rut_norm, length(u.rut_norm) - 1) || p_anio::text || '-' || p_semestre::text || '-')
         )
       )
     )
    WHERE NOT u.sin_match_mol
  ),
  borrador_forma_pago_ok AS (
    SELECT b.codcli
    FROM public.mol_borrador_rematricula b
    WHERE b.anio_periodo = p_anio
      AND b.semestre_periodo = p_semestre
      AND (
        lower(coalesce(b.payload->>'webpayMatriculaEstado', '')) = 'autorizada'
        OR lower(trim(coalesce(b.payload->>'medioMatricula', ''))) IN ('webpay', 'pagare')
        OR lower(trim(coalesce(b.payload->>'medioArancel', ''))) IN ('webpay', 'pagare')
      )
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
      coalesce(ac.forma_pago_ok, false)
        OR (wp.codcli IS NOT NULL)
        OR (bf.codcli IS NOT NULL) AS forma_pago_ok,
      coalesce(ms.firma_ok, false) OR coalesce(ac.firma_ok, false) AS firma_ok,
      coalesce(ms.matriculado_ok, false) OR coalesce(ac.matriculado_ok, false) AS matriculado_ok,
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
      -- Consolidado CAE/BECA + espera CAE ⇒ ambos (aún no abrieron caso ministerial).
      coalesce(cp.espera_ministerial, false)
        OR (
          (coalesce(cp.espera_cae, false) OR coalesce(cae.espera_cae, false))
          AND upper(trim(coalesce(cct.consolidado, ''))) LIKE '%CAE%/%BECA%'
        ) AS espera_ministerial
    FROM universo u
    LEFT JOIN actividad_codcli ac ON ac.codcli = u.codcli
    LEFT JOIN actividad_rut ar ON ar.rut_norm = u.rut_norm
    LEFT JOIN ultima_tyc ut ON ut.codcli = u.codcli
    LEFT JOIN mnp_progreso_sync ms ON ms.codcli = u.codcli
    LEFT JOIN casos_periodo cp ON cp.codcli = u.codcli
    LEFT JOIN cae_pendiente cae ON cae.codcli = u.codcli
    LEFT JOIN cartera_consol_txt cct ON cct.rut_norm = u.rut_norm
    LEFT JOIN webpay_matricula_ok wp ON wp.codcli = u.codcli
    LEFT JOIN borrador_forma_pago_ok bf ON bf.codcli = u.codcli
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
  -- Primer hito OBSERVADO; refresh DELETE/INSERT no es una matrícula nueva por sí mismo.
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
$function$
;


DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer, text);

CREATE FUNCTION public.kpi_mnp_progreso_rematricula(p_anio integer, p_semestre integer, p_email_ejecutivo text DEFAULT NULL::text)
 RETURNS TABLE(total_cartera integer, excluidos_mol integer, sin_match integer, sin_ingreso integer, ingreso integer, tyc integer, datos integer, forma_pago integer, firma integer, matriculado integer, matriculado_bo integer, total_matriculados integer, conflicto_mol_bo integer, rematriculables integer, no_rematriculables integer, rut_dos_carreras text, detalle_dos_carreras jsonb, rematriculable_vigente integer, rematriculable_suspendido integer, rematriculable_eliminado integer, no_rematriculable_vigente integer, no_rematriculable_suspendido integer, no_rematriculable_eliminado integer, forma_pago_espera_cae integer, forma_pago_espera_ministerial integer, forma_pago_espera_ambos integer, forma_pago_resto integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (SELECT count(*) FILTER (WHERE etapa_actual = 'matriculado_bo')::integer FROM embudo) AS matriculado_bo,
    (SELECT count(*) FILTER (WHERE etapa_actual IN ('matriculado', 'matriculado_bo'))::integer FROM embudo) AS total_matriculados,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'conflicto_mol_bo')::integer FROM embudo) AS conflicto_mol_bo,
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
$function$
;


COMMENT ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer) IS
  'Recalcula mnp_progreso_rematricula. matriculado_bo = canal BO; conflicto_mol_bo = evento MOL y canal BO a la vez.';
COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) IS
  'KPI del embudo. total_matriculados = matriculado + matriculado_bo, sin conflictos. p_email_ejecutivo filtra cartera.';

GRANT EXECUTE ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) TO PUBLIC;

COMMIT;
