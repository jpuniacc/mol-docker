-- Tabla consolidada plan de pagos (carga ETL integracion_umas)

CREATE TABLE IF NOT EXISTS public.mnp_mv_plan_pagos_consolidado (
    codcli text,
    rut_alumno text,
    nombre_alumno text,
    apellido_paterno_alumno text,
    apellido_materno_alumno text,
    rut_apoderado text,
    nombre_apoderado text,
    apellido_paterno_apoderado text,
    apellido_materno_apoderado text,
    estado_academico text,
    anio_ingreso integer,
    periodo_ingreso integer,
    codigo_carrera text,
    nombre_carrera text,
    codigo_plan_estudio text,
    nombre_plan_estudio text,
    direccion_alumno text,
    comuna_alumno text,
    ciudad_alumno text,
    email_personal_alumno text,
    telefono_alumno varchar(12),
    telefono_apoderado varchar(12),
    discapacidad text,
    ramos_aprobados integer,
    ramos_reprobados integer,
    ultima_matricula text,
    promedio_notas_2025_2 numeric(10, 1),
    promedio_notas_2025 numeric(10, 1),
    matricula_concepto text,
    matricula_valor numeric(14, 2),
    matricula_n_cuotas integer,
    arancel_concepto text,
    arancel_valor numeric(14, 2),
    arancel_n_cuotas integer,
    alumno_cae text,
    tiene_beneficio text,
    beneficio_ano integer,
    beneficio_periodo integer,
    cantidad_beneficios integer,
    monto_total_beneficios numeric(18, 2),
    beneficios_json jsonb,
    anio_matricula integer,
    periodo_matricula integer,
    synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_mv_plan_cons_codcli
    ON public.mnp_mv_plan_pagos_consolidado (codcli);
CREATE INDEX IF NOT EXISTS idx_mnp_mv_plan_cons_rut
    ON public.mnp_mv_plan_pagos_consolidado (rut_alumno);
CREATE INDEX IF NOT EXISTS idx_mnp_mv_plan_cons_carrera
    ON public.mnp_mv_plan_pagos_consolidado (codigo_carrera);
CREATE INDEX IF NOT EXISTS idx_mnp_mv_plan_cons_matricula
    ON public.mnp_mv_plan_pagos_consolidado (anio_matricula, periodo_matricula);
CREATE INDEX IF NOT EXISTS idx_mnp_mv_plan_cons_synced
    ON public.mnp_mv_plan_pagos_consolidado (synced_at DESC);

COMMENT ON TABLE public.mnp_mv_plan_pagos_consolidado IS
    'Plan de pagos consolidado; lectura vía v_mnp_mv_plan_pagos.';

ALTER TABLE public.mnp_mv_plan_pagos_consolidado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_mv_plan_consolidado_select ON public.mnp_mv_plan_pagos_consolidado;
CREATE POLICY mnp_mv_plan_consolidado_select
    ON public.mnp_mv_plan_pagos_consolidado FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT SELECT ON public.mnp_mv_plan_pagos_consolidado TO anon, authenticated, service_role;
