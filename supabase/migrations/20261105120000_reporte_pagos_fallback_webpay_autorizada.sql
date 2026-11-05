-- Reporte pagos rematrícula: si hay tx Webpay autorizada del concepto, el medio es webpay
-- aunque mol_borrador_rematricula.payload.medioMatricula / medioArancel esté null o desfasado
-- (caso Vladimir Oliva 21339446 / 2027-1: medioArancel null, buy_order …-72 autorizada).
-- Pagaré declarado sigue mandando. Webpay declarado sin tx → pendiente (igual que v2).

CREATE OR REPLACE FUNCTION public.listar_reporte_pagos_rematricula(
  p_anio integer,
  p_semestre integer,
  p_carrera text DEFAULT NULL,
  p_q text DEFAULT NULL
)
RETURNS TABLE(
  codcli text, rut text, rut_norm text, nombre_alumno text,
  codigo_carrera text, nombre_carrera text,
  fec_mat timestamptz,
  medio_matricula text, monto_matricula numeric, fecha_pago_matricula timestamptz,
  buy_order_matricula text, cuotas_matricula integer,
  medio_arancel text, monto_arancel numeric, fecha_pago_arancel timestamptz,
  buy_order_arancel text, cuotas_arancel integer,
  fecha_inicio_pagare date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_carrera text := nullif(trim(coalesce(p_carrera, '')), '');
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_q_norm text;
BEGIN
  IF p_anio IS NULL OR p_semestre IS NULL THEN
    RETURN;
  END IF;
  v_q_norm := CASE WHEN v_q IS NULL THEN NULL ELSE upper(regexp_replace(v_q, '[^0-9Kk]', '', 'g')) END;

  RETURN QUERY
  WITH mol AS (
    SELECT p.codcli, p.rut, p.rut_norm, p.nombre_alumno, p.codigo_carrera, p.nombre_carrera, p.etapa_desde
    FROM public.mnp_progreso_rematricula p
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND p.etapa_actual = 'matriculado'
      AND NOT EXISTS (
        SELECT 1 FROM public.mnp_matricula_cartera_canal cb
        WHERE cb.anio_periodo = p_anio AND cb.semestre_periodo = p_semestre
          AND cb.codcli = p.codcli AND cb.canal = 'BO'
      )
  ),
  base AS (
    SELECT
      m.*,
      c.fec_mat AS c_fec_mat,
      lower(nullif(b.payload->>'medioMatricula', '')) AS medio_mat_raw,
      lower(nullif(b.payload->>'medioArancel', '')) AS medio_ara_raw,
      CASE WHEN jsonb_typeof(b.payload->'pagoMatricula') = 'object' THEN b.payload->'pagoMatricula' END AS plan
    FROM mol m
    LEFT JOIN public.mnp_matricula_cartera_canal c
      ON c.anio_periodo = p_anio AND c.semestre_periodo = p_semestre
     AND c.codcli = m.codcli AND c.canal = 'MOL'
    LEFT JOIN public.mol_borrador_rematricula b
      ON b.anio_periodo = p_anio AND b.semestre_periodo = p_semestre AND b.codcli = m.codcli
  ),
  -- En mnp_webpay_transaccion.codcli suele ir el RUT sin DV (no el CODCLI académico).
  webpay_ult AS (
    SELECT DISTINCT ON (u.codcli, w.concepto)
      u.codcli AS alumno_codcli, w.concepto, w.monto::numeric AS monto,
      coalesce(w.transaction_date, w.actualizado_en) AS fecha, w.buy_order::text AS buy_order
    FROM base u
    JOIN public.mnp_webpay_transaccion w
      ON w.anio_periodo = p_anio AND w.semestre_periodo = p_semestre
     AND w.estado = 'autorizada'
     AND w.concepto IN ('matricula', 'arancel')
     AND w.codcli IS NOT NULL
     AND (
       w.codcli = u.codcli
       OR (u.rut_norm IS NOT NULL AND length(u.rut_norm) >= length(w.codcli)
           AND left(u.rut_norm, length(w.codcli)) = w.codcli)
     )
    ORDER BY u.codcli, w.concepto, w.actualizado_en DESC NULLS LAST, w.creado_en DESC NULLS LAST
  ),
  cuotas AS (
    SELECT u.codcli AS alumno_codcli,
      upper(coalesce(q->>'items', '')) AS item,
      sum(coalesce(nullif(q->>'monto', '')::numeric, 0)) AS monto,
      count(*)::integer AS n
    FROM base u
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(u.plan->'cuotasDetalle') = 'array' THEN u.plan->'cuotasDetalle' ELSE '[]'::jsonb END
    ) q
    GROUP BY 1, 2
  ),
  filas AS (
    SELECT
      u.codcli, u.rut, u.rut_norm, u.nombre_alumno, u.codigo_carrera, u.nombre_carrera,
      coalesce(u.c_fec_mat, u.etapa_desde) AS fec_mat,
      CASE
        WHEN u.medio_mat_raw = 'pagare' THEN 'pagare'
        WHEN wm.alumno_codcli IS NOT NULL THEN 'webpay'
        ELSE 'pendiente'
      END AS medio_matricula,
      wm, wa, qm, qa, u.plan, u.medio_mat_raw, u.medio_ara_raw
    FROM base u
    LEFT JOIN webpay_ult wm ON wm.alumno_codcli = u.codcli AND wm.concepto = 'matricula'
    LEFT JOIN webpay_ult wa ON wa.alumno_codcli = u.codcli AND wa.concepto = 'arancel'
    LEFT JOIN cuotas qm ON qm.alumno_codcli = u.codcli AND qm.item = 'MATRICULA'
    LEFT JOIN cuotas qa ON qa.alumno_codcli = u.codcli AND qa.item = 'ARANCEL'
  ),
  final AS (
    SELECT f.*,
      CASE
        WHEN f.medio_ara_raw = 'pagare' THEN 'pagare'
        WHEN (f.wa).alumno_codcli IS NOT NULL THEN 'webpay'
        ELSE 'pendiente'
      END AS medio_arancel
    FROM filas f
  )
  SELECT
    f.codcli, f.rut, f.rut_norm, f.nombre_alumno, f.codigo_carrera, f.nombre_carrera, f.fec_mat,
    f.medio_matricula,
    CASE f.medio_matricula WHEN 'webpay' THEN (f.wm).monto WHEN 'pagare' THEN (f.qm).monto END,
    CASE WHEN f.medio_matricula = 'webpay' THEN (f.wm).fecha END,
    CASE WHEN f.medio_matricula = 'webpay' THEN (f.wm).buy_order END,
    CASE WHEN f.medio_matricula = 'pagare' THEN (f.qm).n END,
    f.medio_arancel,
    CASE f.medio_arancel WHEN 'webpay' THEN (f.wa).monto WHEN 'pagare' THEN (f.qa).monto END,
    CASE WHEN f.medio_arancel = 'webpay' THEN (f.wa).fecha END,
    CASE WHEN f.medio_arancel = 'webpay' THEN (f.wa).buy_order END,
    CASE WHEN f.medio_arancel = 'pagare' THEN (f.qa).n END,
    CASE WHEN 'pagare' IN (f.medio_matricula, f.medio_arancel)
         THEN nullif(f.plan->>'fechaInicio', '')::date END
  FROM final f
  WHERE (v_carrera IS NULL OR f.codigo_carrera = v_carrera OR f.nombre_carrera = v_carrera)
    AND (
      v_q IS NULL
      OR f.codcli ILIKE '%' || v_q || '%'
      OR coalesce(f.nombre_alumno, '') ILIKE '%' || v_q || '%'
      OR (v_q_norm IS NOT NULL AND v_q_norm <> '' AND coalesce(f.rut_norm, '') LIKE '%' || v_q_norm || '%')
    )
  ORDER BY f.nombre_alumno NULLS LAST, f.codcli;
END;
$function$;

-- kpi_reporte_pagos_rematricula no cambia de firma; sigue leyendo listar_*.

COMMENT ON FUNCTION public.listar_reporte_pagos_rematricula(integer, integer, text, text) IS
  'Reporte pagos rematrícula: medio por concepto. Pagaré si borrador lo declara; Webpay si hay tx autorizada (aunque medio* del borrador sea null); si no, pendiente.';

NOTIFY pgrst, 'reload schema';
