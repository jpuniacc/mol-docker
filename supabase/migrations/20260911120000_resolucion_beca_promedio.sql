ALTER TABLE public.tp_periodo_activo
    ADD COLUMN IF NOT EXISTS promedios_cerrados boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tp_periodo_activo.promedios_cerrados IS
    'true = usar promedio anual (final); false = promedio a la fecha (último período).';

CREATE TABLE IF NOT EXISTS public.mnp_resolucion_beca_promedio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo text NOT NULL
        CHECK (periodo ~ '^\d{4}-0[12]$'),
    codcli text NOT NULL,
    codigo_beneficio text NOT NULL,
    promedio_usado numeric(10, 1),
    fuente text
        CHECK (fuente IS NULL OR fuente IN ('anio', 'periodo')),
    porc_base numeric(14, 5),
    monto_base numeric(18, 2),
    porc_final numeric(14, 5),
    monto_final numeric(18, 2),
    disminucion numeric(6, 4) NOT NULL DEFAULT 0,
    resultado text NOT NULL
        CHECK (resultado IN (
            'MANTIENE',
            'BAJA',
            'PIERDE',
            'BLOQUEO_SIN_PROMEDIO',
            'NO_APLICA'
        )),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (periodo, codcli, codigo_beneficio)
);

CREATE INDEX IF NOT EXISTS idx_mnp_resolucion_beca_alumno
    ON public.mnp_resolucion_beca_promedio (codcli, periodo);

COMMENT ON TABLE public.mnp_resolucion_beca_promedio IS
    'Decisión MOL Art. 13: mantención, baja o pérdida de beca interna por promedio.';

ALTER TABLE public.mnp_resolucion_beca_promedio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_resolucion_beca_no_select ON public.mnp_resolucion_beca_promedio;
CREATE POLICY mnp_resolucion_beca_no_select ON public.mnp_resolucion_beca_promedio
    FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS mnp_resolucion_beca_no_write ON public.mnp_resolucion_beca_promedio;
CREATE POLICY mnp_resolucion_beca_no_write ON public.mnp_resolucion_beca_promedio
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

GRANT SELECT ON public.mnp_resolucion_beca_promedio TO service_role;

CREATE OR REPLACE FUNCTION public.guardar_resoluciones_beca_promedio(
    p_periodo text,
    p_codcli text,
    p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_periodo text := nullif(trim(coalesce(p_periodo, '')), '');
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    elem jsonb;
BEGIN
    IF v_periodo IS NULL OR v_periodo !~ '^\d{4}-0[12]$' THEN
        RAISE EXCEPTION 'periodo inválido';
    END IF;
    IF v_codcli IS NULL THEN
        RAISE EXCEPTION 'codcli requerido';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'items debe ser un arreglo JSON';
    END IF;

    FOR elem IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.mnp_resolucion_beca_promedio (
            periodo,
            codcli,
            codigo_beneficio,
            promedio_usado,
            fuente,
            porc_base,
            monto_base,
            porc_final,
            monto_final,
            disminucion,
            resultado,
            updated_at
        )
        VALUES (
            v_periodo,
            v_codcli,
            nullif(trim(coalesce(elem->>'codigo_beneficio', '')), ''),
            NULLIF(elem->>'promedio_usado', '')::numeric,
            nullif(trim(coalesce(elem->>'fuente', '')), ''),
            NULLIF(elem->>'porc_base', '')::numeric,
            NULLIF(elem->>'monto_base', '')::numeric,
            NULLIF(elem->>'porc_final', '')::numeric,
            NULLIF(elem->>'monto_final', '')::numeric,
            COALESCE(NULLIF(elem->>'disminucion', '')::numeric, 0),
            upper(trim(coalesce(elem->>'resultado', ''))),
            now()
        )
        ON CONFLICT (periodo, codcli, codigo_beneficio)
        DO UPDATE SET
            promedio_usado = EXCLUDED.promedio_usado,
            fuente = EXCLUDED.fuente,
            porc_base = EXCLUDED.porc_base,
            monto_base = EXCLUDED.monto_base,
            porc_final = EXCLUDED.porc_final,
            monto_final = EXCLUDED.monto_final,
            disminucion = EXCLUDED.disminucion,
            resultado = EXCLUDED.resultado,
            updated_at = now();
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_resoluciones_beca_promedio(
    p_codcli text,
    p_periodo text
)
RETURNS SETOF public.mnp_resolucion_beca_promedio
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT *
    FROM public.mnp_resolucion_beca_promedio
    WHERE codcli = trim(p_codcli)
      AND periodo = trim(p_periodo)
    ORDER BY codigo_beneficio;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_resoluciones_beca_promedio(text, text, jsonb)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_resoluciones_beca_promedio(text, text)
    TO anon, authenticated, service_role;
