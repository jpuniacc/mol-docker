-- Verificación CAE MOL: resoluciones por periodo + historial de verificaciones.

CREATE TABLE IF NOT EXISTS public.mnp_resolucion_cae (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codcli text NOT NULL,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL,
    resolucion_disponible boolean NOT NULL DEFAULT false,
    estado_cae text NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mnp_resolucion_cae_codcli_periodo_uniq
        UNIQUE (codcli, anio_periodo, semestre_periodo)
);

CREATE INDEX IF NOT EXISTS idx_mnp_resolucion_cae_periodo
    ON public.mnp_resolucion_cae (anio_periodo, semestre_periodo);

COMMENT ON TABLE public.mnp_resolucion_cae IS
    'Resoluciones CAE cargadas en plataforma por codcli y periodo. Mantenedor DVU pendiente.';

ALTER TABLE public.mnp_resolucion_cae ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_resolucion_cae_no_select_anon ON public.mnp_resolucion_cae;
CREATE POLICY mnp_resolucion_cae_no_select_anon ON public.mnp_resolucion_cae
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_resolucion_cae_no_insert_anon ON public.mnp_resolucion_cae;
CREATE POLICY mnp_resolucion_cae_no_insert_anon ON public.mnp_resolucion_cae
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_resolucion_cae_no_select_authenticated ON public.mnp_resolucion_cae;
CREATE POLICY mnp_resolucion_cae_no_select_authenticated ON public.mnp_resolucion_cae
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_resolucion_cae_no_insert_authenticated ON public.mnp_resolucion_cae;
CREATE POLICY mnp_resolucion_cae_no_insert_authenticated ON public.mnp_resolucion_cae
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.mnp_verificacion_cae_mol (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    resultado text NOT NULL,
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
    CONSTRAINT mnp_verificacion_cae_mol_resultado_chk
        CHECK (resultado IN ('continua', 'pendiente_resolucion'))
);

CREATE INDEX IF NOT EXISTS idx_mnp_verificacion_cae_mol_creado_en
    ON public.mnp_verificacion_cae_mol (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_verificacion_cae_mol_sesion
    ON public.mnp_verificacion_cae_mol (sesion_id)
    WHERE sesion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_verificacion_cae_mol_codcli_periodo
    ON public.mnp_verificacion_cae_mol (codcli, anio_periodo, semestre_periodo);

COMMENT ON TABLE public.mnp_verificacion_cae_mol IS
    'Historial de verificaciones CAE del flujo MOL.';

ALTER TABLE public.mnp_verificacion_cae_mol ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_verificacion_cae_mol_no_select_anon ON public.mnp_verificacion_cae_mol;
CREATE POLICY mnp_verificacion_cae_mol_no_select_anon ON public.mnp_verificacion_cae_mol
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_verificacion_cae_mol_no_insert_anon ON public.mnp_verificacion_cae_mol;
CREATE POLICY mnp_verificacion_cae_mol_no_insert_anon ON public.mnp_verificacion_cae_mol
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_verificacion_cae_mol_no_select_authenticated ON public.mnp_verificacion_cae_mol;
CREATE POLICY mnp_verificacion_cae_mol_no_select_authenticated ON public.mnp_verificacion_cae_mol
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_verificacion_cae_mol_no_insert_authenticated ON public.mnp_verificacion_cae_mol;
CREATE POLICY mnp_verificacion_cae_mol_no_insert_authenticated ON public.mnp_verificacion_cae_mol
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.ejecutar_verificacion_cae_mol(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_sesion_id uuid DEFAULT NULL,
    p_rut_alumno text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_es_mock boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_resolucion record;
    v_resultado text;
    v_accion text;
    v_mensaje text;
    v_id uuid;
BEGIN
    IF v_codcli IS NULL THEN
        RAISE EXCEPTION 'codcli requerido';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'anio_periodo y semestre_periodo requeridos';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    SELECT resolucion_disponible, estado_cae
    INTO v_resolucion
    FROM public.mnp_resolucion_cae
    WHERE codcli = v_codcli
      AND anio_periodo = p_anio_periodo
      AND semestre_periodo = p_semestre_periodo
      AND resolucion_disponible = true
    LIMIT 1;

    IF FOUND THEN
        v_resultado := 'continua';
        v_accion := 'resolucion_ok';
        v_mensaje := 'Resolución CAE disponible para el periodo.';
    ELSE
        v_resultado := 'pendiente_resolucion';
        v_accion := 'pendiente_resolucion';
        v_mensaje := 'Tu registro de matrícula quedará a la espera de la resolución CAE para este periodo.';
    END IF;

    INSERT INTO public.mnp_verificacion_cae_mol (
        resultado,
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
        v_resultado,
        p_sesion_id,
        nullif(trim(coalesce(p_rut_alumno, '')), ''),
        v_codcli,
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
        'cae',
        v_accion,
        'mnp_verificacion_cae_mol',
        v_id,
        jsonb_build_object('resultado', v_resultado),
        p_rut_alumno,
        v_codcli,
        p_nombre_alumno,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        p_es_mock
    );

    RETURN jsonb_build_object(
        'resultado', v_resultado,
        'verificacion_id', v_id,
        'mensaje', v_mensaje
    );
END;
$$;

COMMENT ON FUNCTION public.ejecutar_verificacion_cae_mol IS
    'Verifica resolución CAE del periodo; registra resultado y evento MOL.';

GRANT EXECUTE ON FUNCTION public.ejecutar_verificacion_cae_mol(
    text, integer, integer, uuid, text, text, text, text, boolean
) TO anon, authenticated;

-- Seed de ejemplo (happy path): reemplazar CODCLI_EJEMPLO por un alumno CAE=Si del periodo activo.
-- INSERT INTO public.mnp_resolucion_cae (codcli, anio_periodo, semestre_periodo, resolucion_disponible, estado_cae)
-- VALUES ('CODCLI_EJEMPLO', 2026, 1, true, 'VIGENTE')
-- ON CONFLICT (codcli, anio_periodo, semestre_periodo) DO UPDATE
-- SET resolucion_disponible = EXCLUDED.resolucion_disponible,
--     estado_cae = EXCLUDED.estado_cae,
--     actualizado_en = now();
