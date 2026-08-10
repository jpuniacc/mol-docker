-- Auditoría de aceptación/rechazo de TyC MOL por alumno del flujo.

CREATE TABLE IF NOT EXISTS public.log_mol_tyc_respuesta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    accion text NOT NULL,
    codigo_tyc text NOT NULL DEFAULT 'mol',
    tyc_updated_at timestamptz NOT NULL,
    tyc_titulo text NOT NULL,
    rut_alumno text NULL,
    codcli text NULL,
    nombre_alumno text NULL,
    anio_periodo integer NULL,
    semestre_periodo integer NULL,
    periodo_label text NULL,
    url_origen text NULL,
    es_mock boolean NOT NULL DEFAULT false,
    CONSTRAINT log_mol_tyc_respuesta_accion_chk
        CHECK (accion IN ('acepta', 'rechaza'))
);

CREATE INDEX IF NOT EXISTS idx_log_mol_tyc_respuesta_creado_en
    ON public.log_mol_tyc_respuesta (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_log_mol_tyc_respuesta_rut
    ON public.log_mol_tyc_respuesta (rut_alumno)
    WHERE rut_alumno IS NOT NULL;

COMMENT ON TABLE public.log_mol_tyc_respuesta IS
    'Registro de aceptación o rechazo de TyC por alumno del flujo MOL.';

ALTER TABLE public.log_mol_tyc_respuesta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_mol_tyc_respuesta_no_select_anon ON public.log_mol_tyc_respuesta;
CREATE POLICY log_mol_tyc_respuesta_no_select_anon ON public.log_mol_tyc_respuesta
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS log_mol_tyc_respuesta_no_insert_anon ON public.log_mol_tyc_respuesta;
CREATE POLICY log_mol_tyc_respuesta_no_insert_anon ON public.log_mol_tyc_respuesta
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS log_mol_tyc_respuesta_no_select_authenticated ON public.log_mol_tyc_respuesta;
CREATE POLICY log_mol_tyc_respuesta_no_select_authenticated ON public.log_mol_tyc_respuesta
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS log_mol_tyc_respuesta_no_insert_authenticated ON public.log_mol_tyc_respuesta;
CREATE POLICY log_mol_tyc_respuesta_no_insert_authenticated ON public.log_mol_tyc_respuesta
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.registrar_log_mol_tyc_respuesta(
    p_accion text,
    p_codigo_tyc text DEFAULT 'mol',
    p_tyc_updated_at timestamptz DEFAULT NULL,
    p_tyc_titulo text DEFAULT NULL,
    p_rut_alumno text DEFAULT NULL,
    p_codcli text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_anio_periodo integer DEFAULT NULL,
    p_semestre_periodo integer DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_es_mock boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accion text := nullif(trim(coalesce(p_accion, '')), '');
    v_codigo text := nullif(trim(coalesce(p_codigo_tyc, 'mol')), '');
    v_titulo text := nullif(trim(coalesce(p_tyc_titulo, '')), '');
BEGIN
    IF v_accion IS NULL OR v_accion NOT IN ('acepta', 'rechaza') THEN
        RAISE EXCEPTION 'accion inválida';
    END IF;
    IF v_codigo IS NULL THEN
        RAISE EXCEPTION 'codigo_tyc requerido';
    END IF;
    IF p_tyc_updated_at IS NULL THEN
        RAISE EXCEPTION 'tyc_updated_at requerido';
    END IF;
    IF v_titulo IS NULL THEN
        RAISE EXCEPTION 'tyc_titulo requerido';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.log_mol_tyc_respuesta (
        accion,
        codigo_tyc,
        tyc_updated_at,
        tyc_titulo,
        rut_alumno,
        codcli,
        nombre_alumno,
        anio_periodo,
        semestre_periodo,
        periodo_label,
        url_origen,
        es_mock
    )
    VALUES (
        v_accion,
        v_codigo,
        p_tyc_updated_at,
        v_titulo,
        nullif(trim(coalesce(p_rut_alumno, '')), ''),
        nullif(trim(coalesce(p_codcli, '')), ''),
        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
        p_anio_periodo,
        p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        nullif(trim(coalesce(p_url_origen, '')), ''),
        COALESCE(p_es_mock, false)
    );
END;
$$;

COMMENT ON FUNCTION public.registrar_log_mol_tyc_respuesta IS
    'Registra aceptación o rechazo de TyC MOL por alumno del flujo.';

GRANT EXECUTE ON FUNCTION public.registrar_log_mol_tyc_respuesta(
    text, text, timestamptz, text, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;
