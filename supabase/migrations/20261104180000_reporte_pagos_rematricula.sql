-- Reportes: matriculados × Webpay matrícula/arancel (MVP).

CREATE OR REPLACE FUNCTION public.listar_reporte_pagos_rematricula(
  p_anio integer,
  p_semestre integer,
  p_canal text DEFAULT NULL,
  p_q text DEFAULT NULL
)
RETURNS TABLE (
  codcli text,
  rut text,
  rut_norm text,
  nombre_alumno text,
  codigo_carrera text,
  nombre_carrera text,
  canal text,
  pago_matricula boolean,
  monto_matricula numeric,
  fecha_matricula timestamptz,
  buy_order_matricula text,
  pago_arancel boolean,
  monto_arancel numeric,
  fecha_arancel timestamptz,
  buy_order_arancel text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal text := upper(nullif(trim(coalesce(p_canal, '')), ''));
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_q_norm text;
BEGIN
  IF p_anio IS NULL OR p_semestre IS NULL THEN
    RETURN;
  END IF;
  IF v_canal IS NOT NULL AND v_canal NOT IN ('MOL', 'BO', 'TODOS') THEN
    v_canal := NULL;
  END IF;
  IF v_canal = 'TODOS' THEN
    v_canal := NULL;
  END IF;
  v_q_norm := CASE
    WHEN v_q IS NULL THEN NULL
    ELSE upper(regexp_replace(v_q, '[^0-9K]', '', 'g'))
  END;

  RETURN QUERY
  WITH mol AS (
    SELECT
      p.codcli,
      p.rut,
      p.rut_norm,
      p.nombre_alumno,
      p.codigo_carrera,
      p.nombre_carrera,
      'MOL'::text AS canal
    FROM public.mnp_progreso_rematricula p
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND p.etapa_actual = 'matriculado'
  ),
  bo AS (
    SELECT
      c.codcli,
      pr.rut,
      c.rut_norm,
      coalesce(nullif(trim(pr.nombre_alumno), ''), c.codcli) AS nombre_alumno,
      coalesce(pr.codigo_carrera, c.codcarr) AS codigo_carrera,
      coalesce(pr.nombre_carrera, c.nombre_carrera) AS nombre_carrera,
      'BO'::text AS canal
    FROM public.mnp_matricula_cartera_canal c
    LEFT JOIN public.mnp_progreso_rematricula pr
      ON pr.codcli = c.codcli
     AND pr.anio_periodo = c.anio_periodo
     AND pr.semestre_periodo = c.semestre_periodo
    WHERE c.anio_periodo = p_anio
      AND c.semestre_periodo = p_semestre
      AND c.canal = 'BO'
      AND NOT EXISTS (SELECT 1 FROM mol m WHERE m.codcli = c.codcli)
  ),
  universo AS (
    SELECT * FROM mol
    UNION ALL
    SELECT * FROM bo
  ),
  -- En mnp_webpay_transaccion.codcli suele ir el RUT sin DV (no el CODCLI académico).
  webpay_ult AS (
    SELECT DISTINCT ON (u.codcli, w.concepto)
      u.codcli AS alumno_codcli,
      w.concepto,
      w.monto::numeric AS monto,
      w.actualizado_en,
      w.buy_order::text AS buy_order
    FROM universo u
    INNER JOIN public.mnp_webpay_transaccion w
      ON w.anio_periodo = p_anio
     AND w.semestre_periodo = p_semestre
     AND w.estado = 'autorizada'
     AND w.concepto IN ('matricula', 'arancel')
     AND w.codcli IS NOT NULL
     AND (
       w.codcli = u.codcli
       OR (
         u.rut_norm IS NOT NULL
         AND length(u.rut_norm) >= length(w.codcli)
         AND left(u.rut_norm, length(w.codcli)) = w.codcli
       )
     )
    ORDER BY
      u.codcli,
      w.concepto,
      w.actualizado_en DESC NULLS LAST,
      w.creado_en DESC NULLS LAST
  ),
  filas AS (
    SELECT
      u.codcli,
      u.rut,
      u.rut_norm,
      u.nombre_alumno,
      u.codigo_carrera,
      u.nombre_carrera,
      u.canal,
      (wm.alumno_codcli IS NOT NULL) AS pago_matricula,
      wm.monto AS monto_matricula,
      wm.actualizado_en AS fecha_matricula,
      wm.buy_order AS buy_order_matricula,
      (wa.alumno_codcli IS NOT NULL) AS pago_arancel,
      wa.monto AS monto_arancel,
      wa.actualizado_en AS fecha_arancel,
      wa.buy_order AS buy_order_arancel
    FROM universo u
    LEFT JOIN webpay_ult wm
      ON wm.alumno_codcli = u.codcli AND wm.concepto = 'matricula'
    LEFT JOIN webpay_ult wa
      ON wa.alumno_codcli = u.codcli AND wa.concepto = 'arancel'
  )
  SELECT
    f.codcli,
    f.rut,
    f.rut_norm,
    f.nombre_alumno,
    f.codigo_carrera,
    f.nombre_carrera,
    f.canal,
    f.pago_matricula,
    f.monto_matricula,
    f.fecha_matricula,
    f.buy_order_matricula,
    f.pago_arancel,
    f.monto_arancel,
    f.fecha_arancel,
    f.buy_order_arancel
  FROM filas f
  WHERE (v_canal IS NULL OR f.canal = v_canal)
    AND (
      v_q IS NULL
      OR f.codcli ILIKE '%' || v_q || '%'
      OR coalesce(f.nombre_alumno, '') ILIKE '%' || v_q || '%'
      OR (
        v_q_norm IS NOT NULL
        AND v_q_norm <> ''
        AND coalesce(f.rut_norm, '') LIKE '%' || v_q_norm || '%'
      )
    )
  ORDER BY f.canal, f.nombre_alumno NULLS LAST, f.codcli;
END;
$$;

COMMENT ON FUNCTION public.listar_reporte_pagos_rematricula(integer, integer, text, text) IS
  'Listado matriculados periodo (MOL embudo + BO batch) con última Webpay autorizada mat/arancel.';

GRANT EXECUTE ON FUNCTION public.listar_reporte_pagos_rematricula(integer, integer, text, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kpi_reporte_pagos_rematricula(
  p_anio integer,
  p_semestre integer,
  p_canal text DEFAULT NULL
)
RETURNS TABLE (
  matriculados_total integer,
  matriculados_mol integer,
  matriculados_bo integer,
  webpay_matricula_alumnos integer,
  webpay_matricula_monto numeric,
  webpay_arancel_alumnos integer,
  webpay_arancel_monto numeric,
  mol_sin_webpay_matricula integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM public.listar_reporte_pagos_rematricula(p_anio, p_semestre, p_canal, NULL)
  )
  SELECT
    count(*)::integer AS matriculados_total,
    count(*) FILTER (WHERE canal = 'MOL')::integer AS matriculados_mol,
    count(*) FILTER (WHERE canal = 'BO')::integer AS matriculados_bo,
    count(*) FILTER (WHERE pago_matricula)::integer AS webpay_matricula_alumnos,
    coalesce(sum(monto_matricula) FILTER (WHERE pago_matricula), 0)::numeric AS webpay_matricula_monto,
    count(*) FILTER (WHERE pago_arancel)::integer AS webpay_arancel_alumnos,
    coalesce(sum(monto_arancel) FILTER (WHERE pago_arancel), 0)::numeric AS webpay_arancel_monto,
    count(*) FILTER (WHERE canal = 'MOL' AND NOT pago_matricula)::integer AS mol_sin_webpay_matricula
  FROM base;
$$;

COMMENT ON FUNCTION public.kpi_reporte_pagos_rematricula(integer, integer, text) IS
  'Totales del reporte pagos rematrícula (matriculados × Webpay).';

GRANT EXECUTE ON FUNCTION public.kpi_reporte_pagos_rematricula(integer, integer, text)
  TO anon, authenticated, service_role;

-- Menú: grupo Reportes + Pagos rematrícula (mismo acceso grupo 1 que KPI).
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000070',
  NULL,
  'group',
  'Reportes',
  NULL,
  'DollarSign',
  42,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000071',
  'b0000001-0001-4000-8000-000000000070',
  'link',
  'Pagos rematrícula',
  'dashboard-reportes-pagos-rematricula',
  'Wallet',
  10,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES
  ('b0000001-0001-4000-8000-000000000070', 1),
  ('b0000001-0001-4000-8000-000000000071', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
