-- Descuentos por matrícula anticipada (mantenedor MNP; no ERP).

CREATE TABLE IF NOT EXISTS public.tp_mnp_descuento_matricula_anticipada (
    id serial PRIMARY KEY,
    cod_beneficio integer NOT NULL,
    nombre text NOT NULL,
    periodo text NOT NULL CHECK (periodo ~ '^\d{4}-[12]$'),
    vigencia_desde date NOT NULL,
    vigencia_hasta date NOT NULL,
    aplicable_a text NOT NULL CHECK (aplicable_a IN ('MATRICULA', 'ARANCEL')),
    porcentaje_descuento numeric(5, 2) NOT NULL
        CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100),
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tp_mnp_descuento_matricula_anticipada_vigencia_chk
        CHECK (vigencia_hasta >= vigencia_desde),
    CONSTRAINT tp_mnp_descuento_matricula_anticipada_unico
        UNIQUE (cod_beneficio, periodo, aplicable_a)
);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_descuento_mat_anticipada_periodo_activo
    ON public.tp_mnp_descuento_matricula_anticipada (periodo, activo);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_descuento_mat_anticipada_vigencia
    ON public.tp_mnp_descuento_matricula_anticipada (vigencia_desde, vigencia_hasta);

COMMENT ON TABLE public.tp_mnp_descuento_matricula_anticipada IS
    'Descuentos matrícula anticipada por periodo y concepto (Matrícula/Arancel); mantenedor DVU/TI.';

CREATE OR REPLACE FUNCTION public.tp_mnp_descuento_matricula_anticipada_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tp_mnp_descuento_matricula_anticipada_updated_at
    ON public.tp_mnp_descuento_matricula_anticipada;
CREATE TRIGGER tr_tp_mnp_descuento_matricula_anticipada_updated_at
    BEFORE UPDATE ON public.tp_mnp_descuento_matricula_anticipada
    FOR EACH ROW
    EXECUTE FUNCTION public.tp_mnp_descuento_matricula_anticipada_touch_updated_at();

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_mnp_descuento_matricula_anticipada_select
    ON public.tp_mnp_descuento_matricula_anticipada;
CREATE POLICY tp_mnp_descuento_matricula_anticipada_select
    ON public.tp_mnp_descuento_matricula_anticipada
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_descuento_matricula_anticipada_insert
    ON public.tp_mnp_descuento_matricula_anticipada;
CREATE POLICY tp_mnp_descuento_matricula_anticipada_insert
    ON public.tp_mnp_descuento_matricula_anticipada
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS tp_mnp_descuento_matricula_anticipada_update
    ON public.tp_mnp_descuento_matricula_anticipada;
CREATE POLICY tp_mnp_descuento_matricula_anticipada_update
    ON public.tp_mnp_descuento_matricula_anticipada
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tp_mnp_descuento_matricula_anticipada_delete
    ON public.tp_mnp_descuento_matricula_anticipada;
CREATE POLICY tp_mnp_descuento_matricula_anticipada_delete
    ON public.tp_mnp_descuento_matricula_anticipada
    FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_mnp_descuento_matricula_anticipada
    TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tp_mnp_descuento_matricula_anticipada_id_seq
    TO anon, authenticated, service_role;

-- Seed de ejemplo (planilla inicial)
INSERT INTO public.tp_mnp_descuento_matricula_anticipada (
    id,
    cod_beneficio,
    nombre,
    periodo,
    vigencia_desde,
    vigencia_hasta,
    aplicable_a,
    porcentaje_descuento,
    activo
)
VALUES
    (
        1,
        1425,
        'Matricula Anticipada Noviembre 2026',
        '2027-1',
        '2026-11-01',
        '2026-11-30',
        'MATRICULA',
        20.00,
        true
    ),
    (
        2,
        1564,
        'Matricula Anticipada Noviembre 2026',
        '2027-1',
        '2026-11-01',
        '2026-11-30',
        'ARANCEL',
        10.00,
        true
    )
ON CONFLICT (cod_beneficio, periodo, aplicable_a) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('public.tp_mnp_descuento_matricula_anticipada', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.tp_mnp_descuento_matricula_anticipada), 1)
);
