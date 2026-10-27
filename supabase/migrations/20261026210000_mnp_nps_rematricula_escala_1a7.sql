-- Encuesta de facilidad (CES) de rematrícula: escala 1–5 → 1–7.
-- 1 = muy difícil · 7 = muy fácil. Comentario opcional solo para notas 1–4.

ALTER TABLE public.mnp_nps_rematricula
    DROP CONSTRAINT IF EXISTS mnp_nps_rematricula_calificacion_chk,
    DROP CONSTRAINT IF EXISTS mnp_nps_rematricula_comentario_chk;

ALTER TABLE public.mnp_nps_rematricula
    ADD CONSTRAINT mnp_nps_rematricula_calificacion_chk
        CHECK (calificacion BETWEEN 1 AND 7),
    ADD CONSTRAINT mnp_nps_rematricula_comentario_chk
        CHECK (
            comentario IS NULL
            OR (
                length(comentario) <= 500
                AND calificacion BETWEEN 1 AND 4
            )
        );

COMMENT ON TABLE public.mnp_nps_rematricula IS
    'NPS transaccional de facilidad del flujo de rematrícula (1=muy difícil, 7=muy fácil).';

CREATE OR REPLACE FUNCTION public.guardar_mnp_nps_rematricula(
    p_rut_alumno text,
    p_codcli text,
    p_codigo_carrera text,
    p_jornada text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_calificacion integer,
    p_comentario text DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_sesion_id uuid DEFAULT NULL,
    p_url_origen text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rut text := nullif(trim(coalesce(p_rut_alumno, '')), '');
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_carrera text := nullif(trim(coalesce(p_codigo_carrera, '')), '');
    v_jornada text := nullif(trim(coalesce(p_jornada, '')), '');
    v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
    v_id uuid;
BEGIN
    IF v_rut IS NULL OR v_codcli IS NULL OR v_carrera IS NULL OR v_jornada IS NULL THEN
        RAISE EXCEPTION 'rut, codcli, codigo_carrera y jornada son obligatorios';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'periodo inválido';
    END IF;
    IF p_calificacion IS NULL OR p_calificacion < 1 OR p_calificacion > 7 THEN
        RAISE EXCEPTION 'calificacion debe estar entre 1 y 7';
    END IF;
    IF p_calificacion >= 5 THEN
        v_comentario := NULL;
    ELSIF v_comentario IS NOT NULL AND length(v_comentario) > 500 THEN
        v_comentario := left(v_comentario, 500);
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.mnp_nps_rematricula (
        rut_alumno, codcli, codigo_carrera, jornada,
        anio_periodo, semestre_periodo, periodo_label,
        calificacion, comentario, sesion_id, url_origen
    ) VALUES (
        v_rut, v_codcli, v_carrera, v_jornada,
        p_anio_periodo, p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        p_calificacion, v_comentario, p_sesion_id,
        nullif(trim(coalesce(p_url_origen, '')), '')
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'nps',
        'responde',
        'mnp_nps_rematricula',
        v_id,
        jsonb_build_object('calificacion', p_calificacion),
        v_rut,
        v_codcli,
        NULL,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        false
    );

    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'ya existe una respuesta NPS para este alumno y periodo';
END;
$$;

COMMENT ON FUNCTION public.guardar_mnp_nps_rematricula IS
    'Guarda NPS transaccional de rematrícula (una vez por codcli+periodo).';

GRANT EXECUTE ON FUNCTION public.guardar_mnp_nps_rematricula(
    text, text, text, text, integer, integer, integer, text, text, uuid, text
) TO anon, authenticated, service_role;
