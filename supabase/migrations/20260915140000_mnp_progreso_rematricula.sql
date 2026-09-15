-- KPI Rematrícula — tabla progreso + refresh + RPCs + menú

-- Step 1: Add excluido_mol column to cartera oficial
ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS excluido_mol boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_cartera_oficial.excluido_mol IS
  'true = fuera del flujo MOL (ej. SUBDERE). Sigue en cartera; fuera del denominador KPI.';

-- Step 2: Create mnp_progreso_rematricula table
CREATE TABLE IF NOT EXISTS public.mnp_progreso_rematricula (
  codcli text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  rut text,
  rut_norm text,
  nombre_alumno text,
  codigo_carrera text,
  nombre_carrera text,
  jornada_carrera text,
  etapa_actual text NOT NULL,
  ultima_actividad_en timestamptz,
  ultima_actividad_label text,
  es_mock boolean NOT NULL DEFAULT false,
  excluido_mol boolean NOT NULL DEFAULT false,
  rematriculable boolean NOT NULL DEFAULT false,
  sin_match_mol boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codcli, anio_periodo, semestre_periodo),
  CONSTRAINT mnp_progreso_etapa_chk CHECK (etapa_actual IN (
    'sin_ingreso','ingreso','tyc','datos','forma_pago','firma','matriculado'
  ))
);

CREATE INDEX IF NOT EXISTS idx_mnp_progreso_periodo_etapa
  ON public.mnp_progreso_rematricula (anio_periodo, semestre_periodo, etapa_actual);

CREATE INDEX IF NOT EXISTS idx_mnp_progreso_rut_norm
  ON public.mnp_progreso_rematricula (rut_norm);

COMMENT ON TABLE public.mnp_progreso_rematricula IS
  'Snapshot del progreso de rematrícula por alumno y periodo. Refrescada por RPC.';

ALTER TABLE public.mnp_progreso_rematricula ENABLE ROW LEVEL SECURITY;

-- Sin SELECT directo para anon/authenticated; solo RPCs
DROP POLICY IF EXISTS mnp_progreso_no_select_anon ON public.mnp_progreso_rematricula;
CREATE POLICY mnp_progreso_no_select_anon ON public.mnp_progreso_rematricula
  FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_progreso_no_select_auth ON public.mnp_progreso_rematricula;
CREATE POLICY mnp_progreso_no_select_auth ON public.mnp_progreso_rematricula
  FOR SELECT TO authenticated USING (false);

GRANT SELECT ON public.mnp_progreso_rematricula TO service_role;

-- Step 3: Implement refresh_mnp_progreso_rematricula
CREATE OR REPLACE FUNCTION public.refresh_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validar parámetros
  IF p_anio < 2020 OR p_anio > 2099 OR p_semestre NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Periodo inválido: anio=%, semestre=%', p_anio, p_semestre;
  END IF;

  -- Borrar datos existentes del periodo
  DELETE FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio AND semestre_periodo = p_semestre;

  -- Insertar progreso recalculado
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
      p_anio AS anio_periodo,
      p_semestre AS semestre_periodo,
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
      p_anio AS anio_periodo,
      p_semestre AS semestre_periodo,
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
  -- Calcular hitos para cada alumno
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
      -- tieneIngreso: existe evento/tyc/otp con mismo codcli+periodo, o para sentinel cualquier log con rut_norm match
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
      -- tycAcepta: última respuesta TyC es 'acepta'
      (
        SELECT t.accion = 'acepta'
        FROM public.log_mol_tyc_respuesta t
        WHERE t.codcli = u.codcli
          AND t.anio_periodo = u.anio_periodo
          AND t.semestre_periodo = u.semestre_periodo
        ORDER BY t.creado_en DESC
        LIMIT 1
      ) AS tyc_acepta,
      -- datosOk: existe log_mol_contacto_otp verificar_ok o evento apoderado/discapacidad
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
      -- formaPagoOk: existe evento forma_pago/plan_pago/plan_pagos
      EXISTS (
        SELECT 1 FROM public.log_mol_evento e
        WHERE e.codcli = u.codcli
          AND e.anio_periodo = u.anio_periodo
          AND e.semestre_periodo = u.semestre_periodo
          AND e.categoria IN ('forma_pago', 'plan_pago', 'plan_pagos')
      ) AS forma_pago_ok,
      -- firmaOk: existe mv_matriculados_sync con estado_firma no nulo y no PEND
      EXISTS (
        SELECT 1 FROM public.mv_matriculados_sync m
        WHERE m.codcli = u.codcli
          AND m.ano_mat = u.anio_periodo
          AND m.periodo_mat = u.semestre_periodo
          AND m.estado_firma IS NOT NULL
          AND length(trim(coalesce(m.estado_firma, ''))) > 0
          AND upper(m.estado_firma) NOT LIKE '%PEND%'
      ) AS firma_ok,
      -- matriculadoOk: existe mv_matriculados_sync con mismo periodo
      EXISTS (
        SELECT 1 FROM public.mv_matriculados_sync m
        WHERE m.codcli = u.codcli
          AND m.ano_mat = u.anio_periodo
          AND m.periodo_mat = u.semestre_periodo
      ) AS matriculado_ok
    FROM universo u
  ),
  -- Calcular etapa según prioridad (igual que resolverEtapaProgreso)
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
  -- Última actividad y label
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
      -- Label de última actividad
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
            WHEN lower(trim(categoria)) IN ('contacto', 'contacto_otp') THEN 'Contacto OTP: ' || accion
            WHEN lower(trim(categoria)) = 'apoderado' THEN 'Apoderado: ' || accion
            WHEN lower(trim(categoria)) = 'discapacidad' THEN 'Discapacidad: ' || accion
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
    AND ua.semestre_periodo = ce.semestre_periodo;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer) IS
  'Refresca la tabla mnp_progreso_rematricula para el periodo dado. Retorna filas insertadas.';

-- Step 4: RPCs de lectura

-- kpi_mnp_progreso_rematricula: retorna agregados por etapa
CREATE OR REPLACE FUNCTION public.kpi_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer
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
  matriculado integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::integer AS total_cartera,
    count(*) FILTER (WHERE excluido_mol)::integer AS excluidos_mol,
    count(*) FILTER (WHERE sin_match_mol)::integer AS sin_match,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'sin_ingreso')::integer AS sin_ingreso,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'ingreso')::integer AS ingreso,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'tyc')::integer AS tyc,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'datos')::integer AS datos,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'forma_pago')::integer AS forma_pago,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'firma')::integer AS firma,
    count(*) FILTER (WHERE excluido_mol = false AND sin_match_mol = false AND etapa_actual = 'matriculado')::integer AS matriculado
  FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre;
$$;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer) IS
  'Retorna agregados KPI del embudo de rematrícula para el periodo dado.';

-- listar_mnp_progreso_rematricula: listado con filtros
CREATE OR REPLACE FUNCTION public.listar_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer,
  p_etapa text DEFAULT NULL,
  p_q text DEFAULT NULL
)
RETURNS SETOF public.mnp_progreso_rematricula
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.mnp_progreso_rematricula
  WHERE anio_periodo = p_anio
    AND semestre_periodo = p_semestre
    AND (p_etapa IS NULL OR etapa_actual = p_etapa)
    AND (
      p_q IS NULL
      OR rut ILIKE '%' || p_q || '%'
      OR nombre_alumno ILIKE '%' || p_q || '%'
      OR codcli ILIKE '%' || p_q || '%'
    )
  ORDER BY ultima_actividad_en DESC NULLS LAST
  LIMIT 5000;
$$;

COMMENT ON FUNCTION public.listar_mnp_progreso_rematricula(integer, integer, text, text) IS
  'Lista progreso rematrícula con filtros opcionales de etapa y búsqueda (rut/nombre/codcli).';

-- listar_timeline_mol_alumno: timeline de un alumno
CREATE OR REPLACE FUNCTION public.listar_timeline_mol_alumno(
  p_codcli text,
  p_anio integer,
  p_semestre integer
)
RETURNS SETOF public.v_log_mol_sesion_timeline
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rut_norm text;
BEGIN
  -- Si es SIN_MATCH, extraer rut_norm del codcli
  IF p_codcli LIKE 'SIN_MATCH:%' THEN
    v_rut_norm := substring(p_codcli from 11);
    
    RETURN QUERY
    SELECT *
    FROM public.v_log_mol_sesion_timeline
    WHERE regexp_replace(
            upper(replace(replace(coalesce(rut_alumno,''),'.',''),'-','')),
            '[^0-9K]', '', 'g'
          ) = v_rut_norm
      AND anio_periodo = p_anio
      AND semestre_periodo = p_semestre
    ORDER BY creado_en DESC
    LIMIT 200;
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.v_log_mol_sesion_timeline
    WHERE codcli = p_codcli
      AND anio_periodo = p_anio
      AND semestre_periodo = p_semestre
    ORDER BY creado_en DESC
    LIMIT 200;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.listar_timeline_mol_alumno(text, integer, integer) IS
  'Retorna timeline de eventos MOL para un alumno (codcli o sentinel SIN_MATCH:rut_norm).';

-- Grants para las 4 funciones
GRANT EXECUTE ON FUNCTION public.refresh_mnp_progreso_rematricula(integer, integer)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.listar_mnp_progreso_rematricula(integer, integer, text, text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.listar_timeline_mol_alumno(text, integer, integer)
  TO anon, authenticated, service_role;

-- Step 5: Menú BO

-- KPI rematrícula (orden 28)
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000041',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'KPI rematrícula',
  'dashboard-rematricula-kpi',
  'LayoutDashboard',
  28,
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

-- Seguimiento alumnos (orden 29)
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000042',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Seguimiento alumnos',
  'dashboard-rematricula-seguimiento',
  'ListOrdered',
  29,
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

-- Asignar menús al grupo 1
INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES
  ('b0000001-0001-4000-8000-000000000041', 1),
  ('b0000001-0001-4000-8000-000000000042', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
