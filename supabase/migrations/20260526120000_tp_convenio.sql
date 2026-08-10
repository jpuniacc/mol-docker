-- Catálogo ERP de convenios para simulador plan de pagos

CREATE TABLE IF NOT EXISTS public.tp_convenio (
    id serial PRIMARY KEY,
    codigo_convenio integer NOT NULL,
    descripcion_convenio text NOT NULL,
    concepto text NOT NULL DEFAULT 'ARANCEL'
        CHECK (concepto IN ('MATRICULA', 'ARANCEL', 'AMBOS')),
    tipo_descuento text NOT NULL DEFAULT 'MONTO'
        CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO')),
    valor_descuento numeric(14, 2) NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    created_at date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tp_convenio_codigo
    ON public.tp_convenio (codigo_convenio);

CREATE INDEX IF NOT EXISTS idx_tp_convenio_activo
    ON public.tp_convenio (activo);

COMMENT ON TABLE public.tp_convenio IS
    'Catálogo de convenios para simulador plan de pagos (origen ERP).';

ALTER TABLE public.tp_convenio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_convenio_select ON public.tp_convenio;
CREATE POLICY tp_convenio_select ON public.tp_convenio
    FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.tp_convenio TO anon, authenticated, service_role;

INSERT INTO public.tp_convenio (
    codigo_convenio,
    descripcion_convenio,
    concepto,
    tipo_descuento,
    valor_descuento,
    activo
)
VALUES
    (0, 'Sin Convenio', 'AMBOS', 'MONTO', 0, true),
    (10, 'Convenio Empresa 10%', 'ARANCEL', 'PORCENTAJE', 10, true)
ON CONFLICT (codigo_convenio) DO UPDATE
SET descripcion_convenio = EXCLUDED.descripcion_convenio,
    concepto = EXCLUDED.concepto,
    tipo_descuento = EXCLUDED.tipo_descuento,
    valor_descuento = EXCLUDED.valor_descuento,
    activo = EXCLUDED.activo;
