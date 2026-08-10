-- Catálogo institucional de convenios MNP (Excel + mantenedor; vigente por periodo).
-- No reemplaza public.tp_convenio del simulador.

CREATE TABLE IF NOT EXISTS public.tp_mnp_convenio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_beneficio text,
    institucion text NOT NULL,
    beneficiarios text,
    estado text NOT NULL DEFAULT 'VIGENTE'
        CHECK (estado IN ('VIGENTE', 'EN_TRAMITE', 'NO_VIGENTE')),
    obs_1 text,
    obs_2 text,
    concepto text NOT NULL DEFAULT 'ARANCEL'
        CHECK (concepto IN ('MATRICULA', 'ARANCEL', 'AMBOS')),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tp_mnp_convenio_institucion_lower
    ON public.tp_mnp_convenio (lower(institucion));

CREATE INDEX IF NOT EXISTS idx_tp_mnp_convenio_activo
    ON public.tp_mnp_convenio (activo);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_convenio_estado
    ON public.tp_mnp_convenio (estado);

COMMENT ON TABLE public.tp_mnp_convenio IS
    'Convenios institucionales MNP (matriz de descuentos por oferta; mantenedor + import Excel).';

CREATE TABLE IF NOT EXISTS public.tp_mnp_convenio_descuento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    convenio_id uuid NOT NULL REFERENCES public.tp_mnp_convenio (id) ON DELETE CASCADE,
    oferta_codigo text NOT NULL
        CHECK (oferta_codigo IN (
            'PREGRADO_DIURNO',
            'PREGRADO_VESPERTINO',
            'PREGRADO_ONLINE',
            'PREGRADO_ADVANCE',
            'PREGRADO_SEMIPRESENCIAL',
            'LICENCIATURA',
            'MAGISTER',
            'DIPLOMADOS'
        )),
    aplica boolean NOT NULL DEFAULT false,
    porcentaje numeric(5, 4)
        CHECK (porcentaje IS NULL OR (porcentaje >= 0 AND porcentaje <= 1)),
    CONSTRAINT tp_mnp_convenio_descuento_aplica_chk
        CHECK (
            (aplica = false AND porcentaje IS NULL)
            OR (aplica = true AND porcentaje IS NOT NULL)
        ),
    UNIQUE (convenio_id, oferta_codigo)
);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_convenio_descuento_convenio
    ON public.tp_mnp_convenio_descuento (convenio_id);

COMMENT ON TABLE public.tp_mnp_convenio_descuento IS
    'Descuentos por oferta académica de un convenio institucional MNP.';

CREATE TABLE IF NOT EXISTS public.tp_mnp_convenio_periodo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    convenio_id uuid NOT NULL REFERENCES public.tp_mnp_convenio (id) ON DELETE CASCADE,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL CHECK (semestre_periodo IN (1, 2)),
    activo boolean NOT NULL DEFAULT true,
    UNIQUE (convenio_id, anio_periodo, semestre_periodo)
);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_convenio_periodo_lookup
    ON public.tp_mnp_convenio_periodo (anio_periodo, semestre_periodo, activo);

COMMENT ON TABLE public.tp_mnp_convenio_periodo IS
    'Vigencia de convenios institucionales por periodo académico (anio-semestre).';

-- RLS
ALTER TABLE public.tp_mnp_convenio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tp_mnp_convenio_descuento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tp_mnp_convenio_periodo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_mnp_convenio_select ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_select ON public.tp_mnp_convenio
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_insert ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_insert ON public.tp_mnp_convenio
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_update ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_update ON public.tp_mnp_convenio
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_delete ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_delete ON public.tp_mnp_convenio
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_convenio_descuento_select ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_select ON public.tp_mnp_convenio_descuento
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_insert ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_insert ON public.tp_mnp_convenio_descuento
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_update ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_update ON public.tp_mnp_convenio_descuento
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_delete ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_delete ON public.tp_mnp_convenio_descuento
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_convenio_periodo_select ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_select ON public.tp_mnp_convenio_periodo
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_insert ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_insert ON public.tp_mnp_convenio_periodo
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_update ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_update ON public.tp_mnp_convenio_periodo
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_delete ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_delete ON public.tp_mnp_convenio_periodo
    FOR DELETE TO anon, authenticated USING (true);

-- También permitir anon/service_role como otros mantenedores del proyecto
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_mnp_convenio TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_mnp_convenio_descuento TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_mnp_convenio_periodo TO anon, authenticated, service_role;
