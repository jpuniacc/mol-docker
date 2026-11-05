-- Reportes: Becas asignadas (matriculados MOL).
-- Fuente grabada: mol_borrador_rematricula.payload.lineasBeneficioGrabar
-- Promedio: v_mnp_mv_plan_pagos.prom_anio
-- Art. 13 a nivel alumno: depende del promedio si alguna beca exige medición (catálogo renovable).

CREATE OR REPLACE FUNCTION public.listar_reporte_becas_rematricula(
  p_anio integer,
  p_semestre integer,
  p_carrera text DEFAULT NULL,
  p_q text DEFAULT NULL
)
RETURNS TABLE(
  codcli text,
  rut text,
  rut_norm text,
  nombre_alumno text,
  codigo_carrera text,
  nombre_carrera text,
  fec_mat timestamptz,
  prom_anio numeric,
  cantidad_becas integer,
  monto_becas numeric,
  tiene_exige_promedio boolean,
  resultado_art13 text,
  becas jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_carrera text := nullif(trim(coalesce(p_carrera, '')), '');
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_q_norm text;
  v_periodo_cat text := p_anio::text || '-' || lpad(p_semestre::text, 2, '0');
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
      coalesce(c.fec_mat, m.etapa_desde) AS fec_mat,
      pl.prom_anio,
      CASE
        WHEN jsonb_typeof(b.payload->'lineasBeneficioGrabar') = 'array'
        THEN b.payload->'lineasBeneficioGrabar'
        ELSE '[]'::jsonb
      END AS lineas
    FROM mol m
    LEFT JOIN public.mnp_matricula_cartera_canal c
      ON c.anio_periodo = p_anio AND c.semestre_periodo = p_semestre
     AND c.codcli = m.codcli AND c.canal = 'MOL'
    LEFT JOIN public.mol_borrador_rematricula b
      ON b.anio_periodo = p_anio AND b.semestre_periodo = p_semestre AND b.codcli = m.codcli
    LEFT JOIN public.v_mnp_mv_plan_pagos pl ON pl.codcli = m.codcli
  ),
  becas_enriquecidas AS (
    SELECT
      u.codcli,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'codben', nullif(trim(coalesce(l->>'codben', '')), ''),
          'descripcion', coalesce(nullif(trim(coalesce(l->>'descripcion', '')), ''), cat.beneficio, l->>'codben'),
          'porc', nullif(l->>'porc', '')::numeric,
          'monto', coalesce(nullif(l->>'monto', '')::numeric, 0),
          'flujo', nullif(trim(coalesce(l->>'flujo', '')), ''),
          'concepto', nullif(trim(coalesce(l->>'concepto', '')), ''),
          'renovable', cat.renovable,
          'exige_promedio', CASE
            WHEN cat.renovable IS NULL OR trim(cat.renovable) = '' THEN false
            WHEN upper(cat.renovable) LIKE '%SIN REQUISITO%' THEN false
            WHEN upper(replace(cat.renovable, ',', '.')) LIKE '%PROMEDIO%'
             AND upper(replace(cat.renovable, ',', '.')) LIKE '%5.5%' THEN true
            ELSE false
          END,
          'omite_tope_70', (
            nullif(trim(coalesce(l->>'codben', '')), '') = '1744'
            AND coalesce(nullif(l->>'porc', '')::numeric, 0) >= 100
          )
        )
        ORDER BY coalesce(nullif(l->>'monto', '')::numeric, 0) DESC
      ) FILTER (WHERE l IS NOT NULL AND (nullif(trim(coalesce(l->>'codben', '')), '') IS NOT NULL
                OR nullif(trim(coalesce(l->>'descripcion', '')), '') IS NOT NULL)),
      '[]'::jsonb) AS becas
    FROM base u
    LEFT JOIN LATERAL jsonb_array_elements(u.lineas) l ON true
    LEFT JOIN public.mnp_mv_beneficio_periodo cat
      ON cat.periodo = v_periodo_cat
     AND nullif(trim(coalesce(cat.codigo_beneficio, '')), '') = nullif(trim(coalesce(l->>'codben', '')), '')
    GROUP BY u.codcli
  ),
  filas AS (
    SELECT
      u.codcli, u.rut, u.rut_norm, u.nombre_alumno, u.codigo_carrera, u.nombre_carrera, u.fec_mat,
      u.prom_anio,
      be.becas,
      coalesce(jsonb_array_length(be.becas), 0)::integer AS cantidad_becas,
      coalesce((
        SELECT sum(coalesce((x->>'monto')::numeric, 0))
        FROM jsonb_array_elements(be.becas) x
      ), 0)::numeric AS monto_becas,
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(be.becas) x
        WHERE (x->>'exige_promedio')::boolean IS TRUE
      ) AS tiene_exige_promedio
    FROM base u
    LEFT JOIN becas_enriquecidas be ON be.codcli = u.codcli
  )
  SELECT
    f.codcli, f.rut, f.rut_norm, f.nombre_alumno, f.codigo_carrera, f.nombre_carrera, f.fec_mat,
    f.prom_anio, f.cantidad_becas, f.monto_becas, f.tiene_exige_promedio,
    CASE
      WHEN NOT f.tiene_exige_promedio THEN 'NO_APLICA'
      WHEN f.prom_anio IS NULL OR f.prom_anio <= 0 THEN 'SIN_PROMEDIO'
      WHEN f.prom_anio >= 5.5 THEN 'MANTIENE'
      WHEN f.prom_anio <= 3.9 THEN 'PIERDE'
      ELSE 'BAJA'
    END AS resultado_art13,
    f.becas
  FROM filas f
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

CREATE OR REPLACE FUNCTION public.kpi_reporte_becas_rematricula(
  p_anio integer,
  p_semestre integer,
  p_carrera text DEFAULT NULL
)
RETURNS TABLE(
  matriculados_mol integer,
  con_beca integer,
  sin_beca integer,
  monto_becas numeric,
  art13_mantiene integer,
  art13_baja integer,
  art13_pierde integer,
  art13_sin_promedio integer,
  art13_no_aplica integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH b AS (
    SELECT * FROM public.listar_reporte_becas_rematricula(p_anio, p_semestre, p_carrera, NULL)
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE cantidad_becas > 0)::integer,
    count(*) FILTER (WHERE cantidad_becas = 0)::integer,
    coalesce(sum(monto_becas), 0),
    count(*) FILTER (WHERE resultado_art13 = 'MANTIENE')::integer,
    count(*) FILTER (WHERE resultado_art13 = 'BAJA')::integer,
    count(*) FILTER (WHERE resultado_art13 = 'PIERDE')::integer,
    count(*) FILTER (WHERE resultado_art13 = 'SIN_PROMEDIO')::integer,
    count(*) FILTER (WHERE resultado_art13 = 'NO_APLICA')::integer
  FROM b;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_reporte_becas_rematricula(integer, integer, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kpi_reporte_becas_rematricula(integer, integer, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.listar_reporte_becas_rematricula(integer, integer, text, text) IS
  'Reporte becas asignadas: matriculados MOL + lineasBeneficioGrabar + Art.13 por promedio anual.';

-- Menú Reportes: Becas asignadas + Tiempos por tramo
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000072',
  'b0000001-0001-4000-8000-000000000070',
  'link',
  'Becas asignadas',
  'dashboard-reportes-becas-asignadas',
  'Award',
  20,
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
  'b0000001-0001-4000-8000-000000000073',
  'b0000001-0001-4000-8000-000000000070',
  'link',
  'Tiempos por tramo',
  'dashboard-reportes-tiempos-tramo',
  'Timer',
  30,
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
  ('b0000001-0001-4000-8000-000000000072', 1),
  ('b0000001-0001-4000-8000-000000000073', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
