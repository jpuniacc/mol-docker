-- Encuesta discapacidad MOL: respuestas de negocio + evento mínimo en timeline.

CREATE TABLE IF NOT EXISTS public.mnp_discapacidad_encuesta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    contesta boolean NOT NULL,
    tipo_discapacidad text NULL,
    afirmaciones jsonb NULL,
    sesion_id uuid NULL
        REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL,
    rut_alumno text NULL,
    codcli text NULL,
    nombre_alumno text NULL,
    anio_periodo integer NULL,
    semestre_periodo integer NULL,
    periodo_label text NULL,
    url_origen text NULL,
    es_mock boolean NOT NULL DEFAULT false,
    CONSTRAINT mnp_discapacidad_encuesta_tipo_chk
        CHECK (
            tipo_discapacidad IS NULL
            OR tipo_discapacidad IN ('Física', 'Visual', 'Auditiva', 'Psíquica', 'Autismo')
        ),
    CONSTRAINT mnp_discapacidad_encuesta_contesta_coherente_chk
        CHECK (
            (contesta = false AND tipo_discapacidad IS NULL)
            OR (contesta = true AND tipo_discapacidad IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_mnp_discapacidad_encuesta_creado_en
    ON public.mnp_discapacidad_encuesta (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_discapacidad_encuesta_rut
    ON public.mnp_discapacidad_encuesta (rut_alumno)
    WHERE rut_alumno IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_discapacidad_encuesta_sesion
    ON public.mnp_discapacidad_encuesta (sesion_id)
    WHERE sesion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_discapacidad_encuesta_periodo
    ON public.mnp_discapacidad_encuesta (anio_periodo, semestre_periodo);

COMMENT ON TABLE public.mnp_discapacidad_encuesta IS
    'Respuestas de la encuesta de discapacidad del flujo MOL (datos de negocio).';

ALTER TABLE public.mnp_discapacidad_encuesta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_discapacidad_encuesta_no_select_anon ON public.mnp_discapacidad_encuesta;
CREATE POLICY mnp_discapacidad_encuesta_no_select_anon ON public.mnp_discapacidad_encuesta
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_discapacidad_encuesta_no_insert_anon ON public.mnp_discapacidad_encuesta;
CREATE POLICY mnp_discapacidad_encuesta_no_insert_anon ON public.mnp_discapacidad_encuesta
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_discapacidad_encuesta_no_select_authenticated ON public.mnp_discapacidad_encuesta;
CREATE POLICY mnp_discapacidad_encuesta_no_select_authenticated ON public.mnp_discapacidad_encuesta
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_discapacidad_encuesta_no_insert_authenticated ON public.mnp_discapacidad_encuesta;
CREATE POLICY mnp_discapacidad_encuesta_no_insert_authenticated ON public.mnp_discapacidad_encuesta
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.guardar_mnp_discapacidad_encuesta(
    p_contesta boolean,
    p_tipo_discapacidad text DEFAULT NULL,
    p_afirmaciones jsonb DEFAULT NULL,
    p_sesion_id uuid DEFAULT NULL,
    p_rut_alumno text DEFAULT NULL,
    p_codcli text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_anio_periodo integer DEFAULT NULL,
    p_semestre_periodo integer DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_es_mock boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contesta boolean := COALESCE(p_contesta, false);
    v_tipo text := nullif(trim(coalesce(p_tipo_discapacidad, '')), '');
    v_afirmaciones jsonb := p_afirmaciones;
    v_accion text;
    v_id uuid;
BEGIN
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    IF NOT v_contesta THEN
        v_tipo := NULL;
        v_afirmaciones := NULL;
        v_accion := 'omitir';
    ELSE
        IF v_tipo IS NULL OR v_tipo NOT IN ('Física', 'Visual', 'Auditiva', 'Psíquica', 'Autismo') THEN
            RAISE EXCEPTION 'tipo_discapacidad inválido o requerido';
        END IF;
        IF v_afirmaciones IS NOT NULL AND jsonb_typeof(v_afirmaciones) <> 'array' THEN
            RAISE EXCEPTION 'afirmaciones debe ser un array json';
        END IF;
        v_accion := 'contesta';
    END IF;

    INSERT INTO public.mnp_discapacidad_encuesta (
        contesta,
        tipo_discapacidad,
        afirmaciones,
        sesion_id,
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
        v_contesta,
        v_tipo,
        v_afirmaciones,
        p_sesion_id,
        nullif(trim(coalesce(p_rut_alumno, '')), ''),
        nullif(trim(coalesce(p_codcli, '')), ''),
        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
        p_anio_periodo,
        p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        nullif(trim(coalesce(p_url_origen, '')), ''),
        COALESCE(p_es_mock, false)
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'discapacidad',
        v_accion,
        'mnp_discapacidad_encuesta',
        v_id,
        jsonb_build_object('contesta', v_contesta),
        p_rut_alumno,
        p_codcli,
        p_nombre_alumno,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        p_es_mock
    );

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.guardar_mnp_discapacidad_encuesta IS
    'Guarda respuesta de encuesta discapacidad y registra evento mínimo en log_mol_evento.';

GRANT EXECUTE ON FUNCTION public.guardar_mnp_discapacidad_encuesta(
    boolean, text, jsonb, uuid, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;
