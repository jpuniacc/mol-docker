-- Simulador plan de pago persistente (catálogos + simulaciones guardadas)

-- Catálogo tipos de pago
CREATE TABLE IF NOT EXISTS public.mnp_simulador_tipo_pago (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL,
    nombre text NOT NULL,
    concepto text NOT NULL CHECK (concepto IN ('MATRICULA', 'ARANCEL', 'AMBOS')),
    cuotas_max integer NOT NULL DEFAULT 12 CHECK (cuotas_max > 0),
    activo boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (codigo, concepto)
);

-- Catálogo convenios
CREATE TABLE IF NOT EXISTS public.mnp_simulador_convenio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL UNIQUE,
    nombre text NOT NULL,
    concepto text NOT NULL CHECK (concepto IN ('MATRICULA', 'ARANCEL', 'AMBOS')),
    tipo_descuento text NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO')),
    valor_descuento numeric(14, 2) NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo beca estado
CREATE TABLE IF NOT EXISTS public.mnp_simulador_beca_estado (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL UNIQUE,
    nombre text NOT NULL,
    concepto text NOT NULL CHECK (concepto IN ('MATRICULA', 'ARANCEL', 'AMBOS')),
    tipo_descuento text NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO')),
    valor_descuento numeric(14, 2) NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Reglas generales (clave-valor)
CREATE TABLE IF NOT EXISTS public.mnp_simulador_regla (
    clave text PRIMARY KEY,
    valor_json jsonb NOT NULL,
    descripcion text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cabecera simulación
CREATE TABLE IF NOT EXISTS public.mnp_simulacion_plan_pago (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codcli text NOT NULL,
    rut text,
    nombre_alumno text,
    cod_carrera text,
    nombre_carrera text,
    anio_matricula integer,
    periodo_matricula integer,
    periodo_label text,
    estado text NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'guardada', 'anulada')),
    validez_propuesta date,
    arancel_un_semestre boolean NOT NULL DEFAULT false,
    marca_cae boolean NOT NULL DEFAULT false,
    monto_cae numeric(14, 2) NOT NULL DEFAULT 0,
    abono_resolucion numeric(14, 2) NOT NULL DEFAULT 0,
    abono_contado_arancel numeric(14, 2) NOT NULL DEFAULT 0,
    descuento_medio_pago_pct numeric(5, 2) NOT NULL DEFAULT 0,
    inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    totales_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    matricula_bruto numeric(14, 2),
    arancel_bruto numeric(14, 2),
    monto_neto_financiar numeric(14, 2),
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_sim_plan_codcli
    ON public.mnp_simulacion_plan_pago (codcli);
CREATE INDEX IF NOT EXISTS idx_mnp_sim_plan_created
    ON public.mnp_simulacion_plan_pago (created_at DESC);

-- Detalle por concepto
CREATE TABLE IF NOT EXISTS public.mnp_simulacion_plan_pago_detalle (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacion_id uuid NOT NULL REFERENCES public.mnp_simulacion_plan_pago (id) ON DELETE CASCADE,
    concepto text NOT NULL CHECK (concepto IN ('MATRICULA', 'ARANCEL')),
    tipo_pago_codigo text,
    tipo_pago_nombre text,
    n_cuotas integer NOT NULL DEFAULT 1,
    bruto numeric(14, 2) NOT NULL DEFAULT 0,
    beneficio_erp numeric(14, 2) NOT NULL DEFAULT 0,
    beca_estado numeric(14, 2) NOT NULL DEFAULT 0,
    convenio numeric(14, 2) NOT NULL DEFAULT 0,
    abono numeric(14, 2) NOT NULL DEFAULT 0,
    cae numeric(14, 2) NOT NULL DEFAULT 0,
    beneficio_adicional numeric(14, 2) NOT NULL DEFAULT 0,
    neto numeric(14, 2) NOT NULL DEFAULT 0,
    valor_cuota numeric(14, 2),
    UNIQUE (simulacion_id, concepto)
);

CREATE INDEX IF NOT EXISTS idx_mnp_sim_detalle_sim
    ON public.mnp_simulacion_plan_pago_detalle (simulacion_id);

-- Datos semilla catálogos
INSERT INTO public.mnp_simulador_tipo_pago (codigo, nombre, concepto, cuotas_max, orden)
VALUES
    ('MANDATO', 'Mandato', 'MATRICULA', 12, 10),
    ('CONTADO', 'Contado', 'MATRICULA', 1, 20),
    ('MANDATO', 'Mandato', 'ARANCEL', 12, 10),
    ('CONTADO', 'Contado', 'ARANCEL', 1, 20),
    ('PAC', 'PAC', 'ARANCEL', 10, 30)
ON CONFLICT (codigo, concepto) DO NOTHING;

INSERT INTO public.mnp_simulador_convenio (codigo, nombre, concepto, tipo_descuento, valor_descuento, orden)
VALUES
    ('SIN_CONVENIO', 'Sin Convenio', 'AMBOS', 'MONTO', 0, 0),
    ('CONV_EMPRESA_10', 'Convenio Empresa 10%', 'ARANCEL', 'PORCENTAJE', 10, 10)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.mnp_simulador_beca_estado (codigo, nombre, concepto, tipo_descuento, valor_descuento, orden)
VALUES
    ('SIN_BECA', 'Sin Beca Estado', 'AMBOS', 'MONTO', 0, 0),
    ('BECA_100_ARA', 'Beca Estado 100% Arancel', 'ARANCEL', 'PORCENTAJE', 100, 10),
    ('BECA_50_ARA', 'Beca Estado 50% Arancel', 'ARANCEL', 'PORCENTAJE', 50, 20)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.mnp_simulador_regla (clave, valor_json, descripcion)
VALUES
    ('dias_validez_propuesta', '30'::jsonb, 'Días por defecto para validez de propuesta'),
    ('max_cuotas_matricula', '12'::jsonb, 'Máximo cuotas matrícula'),
    ('max_cuotas_arancel', '12'::jsonb, 'Máximo cuotas arancel'),
    ('descuento_medio_pago_default', '0'::jsonb, 'Descuento % medio de pago por defecto')
ON CONFLICT (clave) DO NOTHING;

-- RLS
ALTER TABLE public.mnp_simulador_tipo_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_simulador_convenio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_simulador_beca_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_simulador_regla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_simulacion_plan_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_simulacion_plan_pago_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_sim_tipo_pago_select ON public.mnp_simulador_tipo_pago;
CREATE POLICY mnp_sim_tipo_pago_select ON public.mnp_simulador_tipo_pago
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_convenio_select ON public.mnp_simulador_convenio;
CREATE POLICY mnp_sim_convenio_select ON public.mnp_simulador_convenio
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_beca_estado_select ON public.mnp_simulador_beca_estado;
CREATE POLICY mnp_sim_beca_estado_select ON public.mnp_simulador_beca_estado
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_regla_select ON public.mnp_simulador_regla;
CREATE POLICY mnp_sim_regla_select ON public.mnp_simulador_regla
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_plan_select ON public.mnp_simulacion_plan_pago;
CREATE POLICY mnp_sim_plan_select ON public.mnp_simulacion_plan_pago
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_plan_insert ON public.mnp_simulacion_plan_pago;
CREATE POLICY mnp_sim_plan_insert ON public.mnp_simulacion_plan_pago
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mnp_sim_plan_update ON public.mnp_simulacion_plan_pago;
CREATE POLICY mnp_sim_plan_update ON public.mnp_simulacion_plan_pago
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mnp_sim_detalle_select ON public.mnp_simulacion_plan_pago_detalle;
CREATE POLICY mnp_sim_detalle_select ON public.mnp_simulacion_plan_pago_detalle
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mnp_sim_detalle_insert ON public.mnp_simulacion_plan_pago_detalle;
CREATE POLICY mnp_sim_detalle_insert ON public.mnp_simulacion_plan_pago_detalle
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mnp_sim_detalle_update ON public.mnp_simulacion_plan_pago_detalle;
CREATE POLICY mnp_sim_detalle_update ON public.mnp_simulacion_plan_pago_detalle
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mnp_sim_detalle_delete ON public.mnp_simulacion_plan_pago_detalle;
CREATE POLICY mnp_sim_detalle_delete ON public.mnp_simulacion_plan_pago_detalle
    FOR DELETE TO authenticated USING (true);

GRANT SELECT ON public.mnp_simulador_tipo_pago TO authenticated, service_role;
GRANT SELECT ON public.mnp_simulador_convenio TO authenticated, service_role;
GRANT SELECT ON public.mnp_simulador_beca_estado TO authenticated, service_role;
GRANT SELECT ON public.mnp_simulador_regla TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.mnp_simulacion_plan_pago TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnp_simulacion_plan_pago_detalle TO authenticated, service_role;

COMMENT ON TABLE public.mnp_simulacion_plan_pago IS
    'Simulaciones de plan de pago guardadas por codcli (rematrícula DVU).';
