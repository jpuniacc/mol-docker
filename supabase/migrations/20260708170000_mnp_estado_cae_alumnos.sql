-- Resoluciones/beneficios asignados ERP (MT_POSBEN) por periodo activo; sync semanal.

CREATE TABLE IF NOT EXISTS public.mnp_estado_cae_alumnos (
    cod_beneficio_cargado integer,
    orden integer,
    codcli text,
    cod_carrera text,
    ano integer,
    periodo integer,
    porc_sol numeric(14, 5),
    porc_apr numeric(14, 5),
    monto_sol numeric(14, 2),
    monto_apr numeric(14, 2),
    monto numeric(14, 2),
    aprobado text,
    aplicable integer,
    fec_mod timestamptz,
    fec_aprob timestamptz,
    fec_asig timestamptz,
    total_sol numeric(14, 2),
    monto_int numeric(14, 2),
    porc_int numeric(14, 5),
    fec_anulacion timestamptz,
    estado integer,
    porc_par numeric(14, 5),
    num_operacion integer,
    tipo_asignacion text,
    confirma_monto text,
    monto_cae_aprobado numeric(14, 2),
    porc_original numeric(14, 5),
    monto_original numeric(14, 2),
    cod_beneficio integer,
    descripcion text,
    nombre_estado_beneficio text,
    anio_matricula integer,
    periodo_matricula integer,
    synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_estado_cae_alumnos_periodo
    ON public.mnp_estado_cae_alumnos (anio_matricula, periodo_matricula);

CREATE INDEX IF NOT EXISTS idx_mnp_estado_cae_alumnos_codcli
    ON public.mnp_estado_cae_alumnos (codcli);

CREATE INDEX IF NOT EXISTS idx_mnp_estado_cae_alumnos_cod_beneficio
    ON public.mnp_estado_cae_alumnos (cod_beneficio);

CREATE INDEX IF NOT EXISTS idx_mnp_estado_cae_alumnos_estado
    ON public.mnp_estado_cae_alumnos (estado);

CREATE INDEX IF NOT EXISTS idx_mnp_estado_cae_alumnos_synced_at
    ON public.mnp_estado_cae_alumnos (synced_at DESC);

ALTER TABLE public.mnp_estado_cae_alumnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_estado_cae_alumnos_select ON public.mnp_estado_cae_alumnos;
CREATE POLICY mnp_estado_cae_alumnos_select ON public.mnp_estado_cae_alumnos
    FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON TABLE public.mnp_estado_cae_alumnos TO anon, authenticated, service_role;

COMMENT ON TABLE public.mnp_estado_cae_alumnos IS
  'Asignaciones MT_POSBEN del periodo activo (CAE y beneficios estables); sync semanal + manual.';
