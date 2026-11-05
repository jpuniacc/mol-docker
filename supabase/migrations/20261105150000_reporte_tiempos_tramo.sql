-- Reportes: tiempos por tramo del embudo (matriculados MOL).
-- Hitos = MIN(creado_en) por alumno/periodo desde log_mol_evento (+ TyC/OTP).

CREATE OR REPLACE FUNCTION public.kpi_reporte_tiempos_tramo_rematricula(
  p_anio integer,
  p_semestre integer,
  p_carrera text DEFAULT NULL
)
RETURNS TABLE(
  tramo text,
  orden integer,
  n integer,
  media_horas numeric,
  mediana_horas numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_carrera text := nullif(trim(coalesce(p_carrera, '')), '');
BEGIN
  IF p_anio IS NULL OR p_semestre IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mol AS (
    SELECT p.codcli, p.rut_norm
    FROM public.mnp_progreso_rematricula p
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND p.etapa_actual = 'matriculado'
      AND NOT EXISTS (
        SELECT 1 FROM public.mnp_matricula_cartera_canal cb
        WHERE cb.anio_periodo = p_anio AND cb.semestre_periodo = p_semestre
          AND cb.codcli = p.codcli AND cb.canal = 'BO'
      )
      AND (v_carrera IS NULL OR p.codigo_carrera = v_carrera OR p.nombre_carrera = v_carrera)
  ),
  ev AS (
    SELECT e.codcli, e.categoria, e.accion, e.creado_en
    FROM public.log_mol_evento e
    JOIN mol m ON m.codcli = e.codcli
    WHERE e.anio_periodo = p_anio AND e.semestre_periodo = p_semestre
      AND coalesce(e.es_mock, false) = false
    UNION ALL
    SELECT t.codcli, 'tyc'::text, t.accion, t.creado_en
    FROM public.log_mol_tyc_respuesta t
    JOIN mol m ON m.codcli = t.codcli
    WHERE t.anio_periodo = p_anio AND t.semestre_periodo = p_semestre
      AND coalesce(t.es_mock, false) = false
    UNION ALL
    SELECT o.codcli, 'contacto_otp'::text, o.evento, o.creado_en
    FROM public.log_mol_contacto_otp o
    JOIN mol m ON m.codcli = o.codcli
    WHERE o.anio_periodo = p_anio AND o.semestre_periodo = p_semestre
      AND coalesce(o.es_mock, false) = false
  ),
  hitos AS (
    SELECT
      m.codcli,
      min(ev.creado_en) AS ts_ingreso,
      min(ev.creado_en) FILTER (WHERE ev.categoria = 'tyc' AND ev.accion = 'acepta') AS ts_tyc,
      min(ev.creado_en) FILTER (
        WHERE (ev.categoria = 'contacto_otp' AND ev.accion = 'verificar_ok')
           OR (ev.categoria = 'apoderado' AND ev.accion IN ('confirma_ok', 'confirma_desactualizado'))
           OR (ev.categoria = 'discapacidad' AND ev.accion IN ('omitir', 'contesta'))
      ) AS ts_datos,
      min(ev.creado_en) FILTER (
        WHERE ev.categoria IN ('forma_pago', 'plan_pago', 'plan_pagos', 'cuenta')
          AND ev.accion IN ('confirmado', 'grabar', 'selecciona', 'ok')
      ) AS ts_forma_pago,
      min(ev.creado_en) FILTER (WHERE ev.categoria = 'firma' AND ev.accion = 'firmado') AS ts_firma,
      min(ev.creado_en) FILTER (WHERE ev.categoria = 'matricula' AND ev.accion = 'matriculado') AS ts_matriculado
    FROM mol m
    LEFT JOIN ev ON ev.codcli = m.codcli
    GROUP BY m.codcli
  ),
  dur AS (
    SELECT 'ingreso_tyc'::text AS tramo, 1 AS orden,
      extract(epoch FROM (ts_tyc - ts_ingreso)) / 3600.0 AS horas
    FROM hitos WHERE ts_ingreso IS NOT NULL AND ts_tyc IS NOT NULL AND ts_tyc >= ts_ingreso
    UNION ALL
    SELECT 'tyc_datos', 2,
      extract(epoch FROM (ts_datos - ts_tyc)) / 3600.0
    FROM hitos WHERE ts_tyc IS NOT NULL AND ts_datos IS NOT NULL AND ts_datos >= ts_tyc
    UNION ALL
    SELECT 'datos_forma_pago', 3,
      extract(epoch FROM (ts_forma_pago - ts_datos)) / 3600.0
    FROM hitos WHERE ts_datos IS NOT NULL AND ts_forma_pago IS NOT NULL AND ts_forma_pago >= ts_datos
    UNION ALL
    SELECT 'forma_pago_firma', 4,
      extract(epoch FROM (ts_firma - ts_forma_pago)) / 3600.0
    FROM hitos WHERE ts_forma_pago IS NOT NULL AND ts_firma IS NOT NULL AND ts_firma >= ts_forma_pago
    UNION ALL
    SELECT 'firma_matriculado', 5,
      extract(epoch FROM (ts_matriculado - ts_firma)) / 3600.0
    FROM hitos WHERE ts_firma IS NOT NULL AND ts_matriculado IS NOT NULL AND ts_matriculado >= ts_firma
  ),
  agg AS (
    SELECT
      d.tramo,
      d.orden,
      count(*)::integer AS n,
      round(avg(d.horas)::numeric, 2) AS media_horas,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY d.horas))::numeric, 2) AS mediana_horas
    FROM dur d
    GROUP BY d.tramo, d.orden
  ),
  skeleton AS (
    SELECT * FROM (VALUES
      ('ingreso_tyc'::text, 1),
      ('tyc_datos', 2),
      ('datos_forma_pago', 3),
      ('forma_pago_firma', 4),
      ('firma_matriculado', 5)
    ) AS s(tramo, orden)
  )
  SELECT
    s.tramo,
    s.orden,
    coalesce(a.n, 0)::integer,
    a.media_horas,
    a.mediana_horas
  FROM skeleton s
  LEFT JOIN agg a ON a.tramo = s.tramo
  ORDER BY s.orden;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kpi_reporte_tiempos_tramo_rematricula(integer, integer, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.kpi_reporte_tiempos_tramo_rematricula(integer, integer, text) IS
  'Media/mediana (horas) por tramo del embudo entre matriculados MOL del periodo.';

NOTIFY pgrst, 'reload schema';
