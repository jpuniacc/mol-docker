-- Cartera de beneficios (becas) por periodo (Excel).
-- Almacena becas vigentes por alumno para cruce con plan de pagos.

CREATE TABLE IF NOT EXISTS public.mnp_cartera_beneficios (
    periodo text NOT NULL CHECK (periodo ~ '^\d{4}-0[12]$'),
    rut_norm text NOT NULL,
    codcli_excel text NOT NULL,
    codcarpr text,
    beca_1 text,
    pct_1 numeric(8, 2),
    beca_2 text,
    pct_2 numeric(8, 2),
    consolidado text,
    cod_beneficio_1 text,
    cod_beneficio_2 text,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (periodo, codcli_excel)
);

CREATE INDEX IF NOT EXISTS idx_mnp_cartera_beneficios_rut
    ON public.mnp_cartera_beneficios (periodo, rut_norm);

COMMENT ON TABLE public.mnp_cartera_beneficios IS
    'Cartera de beneficios (becas) vigentes por periodo. Cruzar por periodo + codcli_excel (PK) o rut_norm (fallback).';

ALTER TABLE public.mnp_cartera_beneficios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_cartera_beneficios_select ON public.mnp_cartera_beneficios;
CREATE POLICY mnp_cartera_beneficios_select
    ON public.mnp_cartera_beneficios FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT SELECT ON public.mnp_cartera_beneficios TO anon, authenticated, service_role;

-- RPC para consultar beneficios: prefer codcli_excel, fallback rut_norm
CREATE OR REPLACE FUNCTION public.consultar_cartera_beneficios(
    p_periodo text,
    p_codcli_excel text DEFAULT NULL,
    p_rut_norm text DEFAULT NULL
)
RETURNS SETOF public.mnp_cartera_beneficios
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM public.mnp_cartera_beneficios
    WHERE periodo = p_periodo
      AND (
          (p_codcli_excel IS NOT NULL AND codcli_excel = p_codcli_excel)
          OR (p_codcli_excel IS NULL AND p_rut_norm IS NOT NULL AND rut_norm = p_rut_norm)
      );
$$;

GRANT EXECUTE ON FUNCTION public.consultar_cartera_beneficios(text, text, text)
    TO anon, authenticated, service_role;
