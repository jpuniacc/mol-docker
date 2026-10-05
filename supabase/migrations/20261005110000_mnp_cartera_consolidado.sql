-- Marca CAE / beca ministerial / SUBDERE desde CARTERA 2027_1.
-- Vive fuera de mnp_mv_plan_pagos_consolidado porque esa tabla se trunca en cada sync.

CREATE TABLE IF NOT EXISTS public.mnp_cartera_consolidado (
    periodo text NOT NULL CHECK (periodo ~ '^\d{4}-0[12]$'),
    rut_norm text NOT NULL,
    codcarpr text NOT NULL,
    consolidado text,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (periodo, rut_norm, codcarpr)
);

COMMENT ON TABLE public.mnp_cartera_consolidado IS
    'Texto CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE del Excel de cartera, por RUT y carrera.';

COMMENT ON COLUMN public.mnp_cartera_consolidado.consolidado IS
    'CAE, BECA MINISTERIAL, CAE/BECA MINISTERIAL, SUBDERE, o null si el Excel viene vacío.';

ALTER TABLE public.mnp_cartera_consolidado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_cartera_consolidado_select ON public.mnp_cartera_consolidado;
CREATE POLICY mnp_cartera_consolidado_select
    ON public.mnp_cartera_consolidado FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT SELECT ON public.mnp_cartera_consolidado TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.v_mnp_mv_plan_pagos
WITH (security_invoker = true)
AS
SELECT
    c.codcli,
    c.rut_alumno AS rut,
    c.nombre_alumno,
    c.apellido_paterno_alumno,
    c.apellido_materno_alumno,
    c.es_responsable_financiero,
    c.rut_apoderado AS rut_apoder,
    c.nombre_apoderado,
    c.apellido_paterno_apoderado,
    c.apellido_materno_apoderado,
    c.telefono_apoder,
    c.mail_apoder,
    c.estado_academico,
    c.anio_ingreso AS ano_ingreso,
    c.periodo_ingreso,
    c.categoria_alumno,
    c.jornada_carrera,
    c.codigo_carrera AS cod_carrera,
    c.nombre_carrera AS carrera,
    c.codigo_plan_estudio AS codigo_planestudio,
    c.nombre_plan_estudio AS nombre_planestudios,
    c.direccion_alumno AS direccion,
    c.comuna_alumno AS comuna,
    c.ciudad_alumno AS ciudad,
    c.email_personal_alumno AS mail,
    c.telefono_alumno AS telefono,
    c.telefono_apoderado,
    c.discapacidad,
    c.ramos_aprobados,
    c.ramos_reprobados,
    c.ultima_matricula AS ult_matricula,
    c.ultima_situacion,
    c.periodo_rematricula,
    c.promedio_notas_2025_2 AS prom_ultimo_periodo,
    c.promedio_notas_2025 AS prom_anio,
    c.matricula_valor AS precio_matricula,
    c.matricula_n_cuotas AS cuotas_matricula,
    NULL::text AS doc_pago_matricula,
    c.arancel_valor AS precio_arancel,
    c.arancel_n_cuotas AS cuotas_arancel,
    NULL::text AS doc_pago_arancel,
    ben.monto_beneficio_matricula,
    ben.monto_beneficio_arancel,
    ben.beneficios_detalle,
    c.anio_matricula,
    c.periodo_matricula,
    (c.anio_matricula::text || '-' || c.periodo_matricula::text) AS periodo,
    c.synced_at,
    c.nombre_carrera,
    c.matricula_valor AS monto_matricula,
    c.arancel_valor AS monto_arancel,
    c.matricula_n_cuotas AS cuota_matricula,
    c.arancel_n_cuotas AS cuota_arancel,
    ben.monto_beneficio_matricula AS beca_matricula,
    ben.monto_beneficio_arancel AS beca_arancel,
    COALESCE(c.matricula_valor, 0) - COALESCE(ben.monto_beneficio_matricula, 0) AS valor_total_matricula,
    COALESCE(c.arancel_valor, 0) - COALESCE(ben.monto_beneficio_arancel, 0) AS valor_total_arancel,
    c.alumno_cae,
    c.tiene_beneficio,
    c.beneficio_ano,
    c.beneficio_periodo,
    c.cantidad_beneficios,
    c.monto_total_beneficios,
    c.fuera_cartera_oficial,
    k.consolidado
FROM public.mnp_mv_plan_pagos_consolidado c
LEFT JOIN public.mnp_cartera_consolidado k
    ON k.periodo = '2027-01'
   AND k.codcarpr = c.codigo_carrera
   AND k.rut_norm = regexp_replace(
        upper(replace(replace(coalesce(c.rut_alumno, ''), '.', ''), '-', '')),
        '[^0-9K]',
        '',
        'g'
    )
LEFT JOIN LATERAL (
    SELECT
        COALESCE(
            SUM(COALESCE(NULLIF(elem->>'monto', '')::numeric, NULLIF(elem->>'monto_aprobado', '')::numeric, 0))
                FILTER (WHERE UPPER(COALESCE(elem->>'aplicable', '')) IN ('MATRICULA', 'M')),
            0
        )
            AS monto_beneficio_matricula,
        COALESCE(
            SUM(COALESCE(NULLIF(elem->>'monto', '')::numeric, NULLIF(elem->>'monto_aprobado', '')::numeric, 0))
                FILTER (
                    WHERE UPPER(COALESCE(elem->>'aplicable', '')) IN ('ARANCEL', 'A', 'S', 'SI')
                       OR COALESCE(elem->>'aplicable', '') = ''
                ),
            0
        )
            AS monto_beneficio_arancel,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'cod_beneficio', elem->>'codigo_beneficio',
                    'descripcion', elem->>'descripcion',
                    'monto', NULLIF(elem->>'monto', '')::numeric,
                    'monto_aprobado', NULLIF(elem->>'monto_aprobado', '')::numeric,
                    'monto_solicitado', NULLIF(elem->>'monto_solicitado', '')::numeric,
                    'porc_apr', NULLIF(elem->>'porcentaje_aprobado', '')::numeric,
                    'porc_sol', NULLIF(elem->>'porcentaje_solicitud', '')::numeric,
                    'aplicable', elem->>'aplicable',
                    'estado', elem->>'estado'
                )
                ORDER BY elem->>'codigo_beneficio'
            ) FILTER (WHERE elem IS NOT NULL),
            '[]'::jsonb
        ) AS beneficios_detalle
    FROM jsonb_array_elements(COALESCE(c.beneficios_json, '[]'::jsonb)) AS elem
) ben ON true;

GRANT SELECT ON public.v_mnp_mv_plan_pagos TO anon, authenticated, service_role;
