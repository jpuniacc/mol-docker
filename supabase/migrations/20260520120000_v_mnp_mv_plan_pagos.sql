-- Vista plan de pagos MV + lectura portal (requiere tablas mnp_mv_* cargadas por integracion_umas)

CREATE OR REPLACE VIEW public.v_mnp_mv_plan_pagos
WITH (security_invoker = true)
AS
SELECT
    m.codcli,
    m.rut,
    m.nombre_alumno,
    m.apellido_paterno_alumno,
    m.apellido_materno_alumno,
    m.rut_apoder,
    m.nombre_apoderado,
    m.apellido_paterno_apoderado,
    m.apellido_materno_apoderado,
    m.estado_academico,
    m.ano_ingreso,
    m.periodo_ingreso,
    m.cod_carrera,
    m.carrera,
    m.codigo_planestudio,
    m.nombre_planestudios,
    m.direccion,
    m.comuna,
    m.ciudad,
    m.mail,
    m.telefono,
    m.telefono_apoderado,
    m.discapacidad,
    m.ramos_aprobados,
    m.ramos_reprobados,
    m.ult_matricula,
    m.prom_ultimo_periodo,
    m.prom_anio,
    pp.precio_matricula,
    pp.cuotas_matricula,
    pp.doc_pago_matricula,
    pp.precio_arancel,
    pp.cuotas_arancel,
    pp.doc_pago_arancel,
    ben.monto_beneficio_matricula,
    ben.monto_beneficio_arancel,
    ben.beneficios_detalle,
    m.anio_matricula,
    m.periodo_matricula,
    (m.anio_matricula::text || '-' || m.periodo_matricula::text) AS periodo,
    GREATEST(
        m.synced_at,
        COALESCE(pp.synced_at, m.synced_at),
        COALESCE(ben.synced_at_max, m.synced_at)
    ) AS synced_at,
    m.carrera AS nombre_carrera,
    pp.precio_matricula AS monto_matricula,
    pp.precio_arancel AS monto_arancel,
    pp.cuotas_matricula AS cuota_matricula,
    pp.cuotas_arancel AS cuota_arancel,
    ben.monto_beneficio_matricula AS beca_matricula,
    ben.monto_beneficio_arancel AS beca_arancel,
    COALESCE(pp.precio_matricula, 0) - COALESCE(ben.monto_beneficio_matricula, 0) AS valor_total_matricula,
    COALESCE(pp.precio_arancel, 0) - COALESCE(ben.monto_beneficio_arancel, 0) AS valor_total_arancel
FROM public.mnp_mv_alumnos_matricular_periodo m
LEFT JOIN (
    SELECT
        codcli,
        cod_carrera,
        anio_matricula,
        periodo_matricula,
        MAX(synced_at) AS synced_at,
        MAX(CASE WHEN concepto = 'MATRICULA' THEN precio END) AS precio_matricula,
        MAX(CASE WHEN concepto = 'MATRICULA' THEN n_cuotas END) AS cuotas_matricula,
        MAX(CASE WHEN concepto = 'MATRICULA' THEN doc_pago END) AS doc_pago_matricula,
        MAX(CASE WHEN concepto = 'ARANCEL' THEN precio END) AS precio_arancel,
        MAX(CASE WHEN concepto = 'ARANCEL' THEN n_cuotas END) AS cuotas_arancel,
        MAX(CASE WHEN concepto = 'ARANCEL' THEN doc_pago END) AS doc_pago_arancel
    FROM public.mnp_mv_alumnos_plan_pago
    WHERE ano = anio_matricula
      AND periodo = periodo_matricula
    GROUP BY codcli, cod_carrera, anio_matricula, periodo_matricula
) pp
    ON pp.codcli = m.codcli
   AND pp.cod_carrera = m.cod_carrera
   AND pp.anio_matricula = m.anio_matricula
   AND pp.periodo_matricula = m.periodo_matricula
LEFT JOIN LATERAL (
    SELECT
        COALESCE(SUM(b.monto) FILTER (WHERE b.aplicable = 'MATRICULA'), 0) AS monto_beneficio_matricula,
        COALESCE(SUM(b.monto) FILTER (WHERE b.aplicable = 'ARANCEL'), 0) AS monto_beneficio_arancel,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'cod_beneficio', b.cod_beneficio,
                    'descripcion', b.descripcion,
                    'monto', b.monto,
                    'porc_apr', b.porc_apr,
                    'aplicable', b.aplicable,
                    'estado', b.estado
                )
                ORDER BY b.cod_beneficio
            ) FILTER (WHERE b.codcli IS NOT NULL),
            '[]'::jsonb
        ) AS beneficios_detalle,
        MAX(b.synced_at) AS synced_at_max
    FROM public.mnp_mv_alumnos_beneficios b
    WHERE b.codcli = m.codcli
      AND b.cod_carrera = m.cod_carrera
      AND b.anio_matricula = m.anio_matricula
      AND b.periodo_matricula = m.periodo_matricula
      AND b.ano = m.anio_matricula
      AND b.periodo = m.periodo_matricula
) ben ON true;

COMMENT ON VIEW public.v_mnp_mv_plan_pagos IS
    'Plan de pagos rematrícula: matrícula MV + plan de pago + beneficios. Lectura DVU.';

-- Tablas base (si solo existen por ETL, asegurar RLS de lectura)
ALTER TABLE public.mnp_mv_alumnos_matricular_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_mv_alumnos_plan_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_mv_alumnos_beneficios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_mv_matricular_select ON public.mnp_mv_alumnos_matricular_periodo;
CREATE POLICY mnp_mv_matricular_select
    ON public.mnp_mv_alumnos_matricular_periodo FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS mnp_mv_plan_pago_select ON public.mnp_mv_alumnos_plan_pago;
CREATE POLICY mnp_mv_plan_pago_select
    ON public.mnp_mv_alumnos_plan_pago FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS mnp_mv_beneficios_select ON public.mnp_mv_alumnos_beneficios;
CREATE POLICY mnp_mv_beneficios_select
    ON public.mnp_mv_alumnos_beneficios FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT SELECT ON public.mnp_mv_alumnos_matricular_periodo TO anon, authenticated, service_role;
GRANT SELECT ON public.mnp_mv_alumnos_plan_pago TO anon, authenticated, service_role;
GRANT SELECT ON public.mnp_mv_alumnos_beneficios TO anon, authenticated, service_role;
GRANT SELECT ON public.v_mnp_mv_plan_pagos TO anon, authenticated, service_role;
