-- Timeline unificado MOL + enlace sesion_id en tablas detalle.
-- Requiere log_sesion_usuario y log_mol_tyc_respuesta (migraciones 20260707140000 / 20260707140100).
-- Si log_mol_contacto_otp aún no existe (20260707160000), se crea aquí de forma idempotente.

CREATE TABLE IF NOT EXISTS public.log_mol_contacto_otp (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    canal text NOT NULL,
    evento text NOT NULL,
    numero_envio smallint NULL,
    contacto_mascara text NULL,
    rut_alumno text NULL,
    codcli text NULL,
    nombre_alumno text NULL,
    anio_periodo integer NULL,
    semestre_periodo integer NULL,
    periodo_label text NULL,
    url_origen text NULL,
    es_mock boolean NOT NULL DEFAULT false,
    CONSTRAINT log_mol_contacto_otp_canal_chk
        CHECK (canal IN ('correo', 'telefono')),
    CONSTRAINT log_mol_contacto_otp_evento_chk
        CHECK (evento IN ('envio', 'reenvio', 'verificar_ok', 'verificar_fallido', 'continuar_sin_otp')),
    CONSTRAINT log_mol_contacto_otp_numero_envio_chk
        CHECK (numero_envio IS NULL OR numero_envio BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_log_mol_contacto_otp_creado_en
    ON public.log_mol_contacto_otp (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_log_mol_contacto_otp_rut
    ON public.log_mol_contacto_otp (rut_alumno)
    WHERE rut_alumno IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_log_mol_contacto_otp_canal_evento
    ON public.log_mol_contacto_otp (canal, evento);

COMMENT ON TABLE public.log_mol_contacto_otp IS
    'Registro de envíos, reintentos y validación OTP de contacto en flujo MOL.';

ALTER TABLE public.log_mol_contacto_otp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_mol_contacto_otp_no_select_anon ON public.log_mol_contacto_otp;
CREATE POLICY log_mol_contacto_otp_no_select_anon ON public.log_mol_contacto_otp
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS log_mol_contacto_otp_no_insert_anon ON public.log_mol_contacto_otp;
CREATE POLICY log_mol_contacto_otp_no_insert_anon ON public.log_mol_contacto_otp
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS log_mol_contacto_otp_no_select_authenticated ON public.log_mol_contacto_otp;
CREATE POLICY log_mol_contacto_otp_no_select_authenticated ON public.log_mol_contacto_otp
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS log_mol_contacto_otp_no_insert_authenticated ON public.log_mol_contacto_otp;
CREATE POLICY log_mol_contacto_otp_no_insert_authenticated ON public.log_mol_contacto_otp
    FOR INSERT TO authenticated WITH CHECK (false);

ALTER TABLE public.log_mol_tyc_respuesta
    ADD COLUMN IF NOT EXISTS sesion_id uuid NULL
    REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL;

ALTER TABLE public.log_mol_contacto_otp
    ADD COLUMN IF NOT EXISTS sesion_id uuid NULL
    REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_log_mol_tyc_respuesta_sesion
    ON public.log_mol_tyc_respuesta (sesion_id)
    WHERE sesion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_log_mol_contacto_otp_sesion
    ON public.log_mol_contacto_otp (sesion_id)
    WHERE sesion_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.log_mol_evento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    sesion_id uuid NULL
        REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL,
    categoria text NOT NULL,
    accion text NOT NULL,
    origen_tabla text NULL,
    origen_id uuid NULL,
    payload jsonb NULL,
    rut_alumno text NULL,
    codcli text NULL,
    nombre_alumno text NULL,
    anio_periodo integer NULL,
    semestre_periodo integer NULL,
    periodo_label text NULL,
    url_origen text NULL,
    es_mock boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_log_mol_evento_sesion_creado
    ON public.log_mol_evento (sesion_id, creado_en);

CREATE INDEX IF NOT EXISTS idx_log_mol_evento_creado_en
    ON public.log_mol_evento (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_log_mol_evento_rut
    ON public.log_mol_evento (rut_alumno)
    WHERE rut_alumno IS NOT NULL;

COMMENT ON TABLE public.log_mol_evento IS
    'Timeline unificado de eventos del flujo MOL, enlazado a log_sesion_usuario.';

ALTER TABLE public.log_mol_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_mol_evento_no_select_anon ON public.log_mol_evento;
CREATE POLICY log_mol_evento_no_select_anon ON public.log_mol_evento
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS log_mol_evento_no_insert_anon ON public.log_mol_evento;
CREATE POLICY log_mol_evento_no_insert_anon ON public.log_mol_evento
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS log_mol_evento_no_select_authenticated ON public.log_mol_evento;
CREATE POLICY log_mol_evento_no_select_authenticated ON public.log_mol_evento
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS log_mol_evento_no_insert_authenticated ON public.log_mol_evento;
CREATE POLICY log_mol_evento_no_insert_authenticated ON public.log_mol_evento
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.registrar_log_mol_evento(
    p_sesion_id uuid DEFAULT NULL,
    p_categoria text DEFAULT NULL,
    p_accion text DEFAULT NULL,
    p_origen_tabla text DEFAULT NULL,
    p_origen_id uuid DEFAULT NULL,
    p_payload jsonb DEFAULT NULL,
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
    v_categoria text := nullif(trim(coalesce(p_categoria, '')), '');
    v_accion text := nullif(trim(coalesce(p_accion, '')), '');
    v_id uuid;
BEGIN
    IF v_categoria IS NULL OR v_accion IS NULL THEN
        RAISE EXCEPTION 'categoria y accion requeridos';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.log_mol_evento (
        sesion_id,
        categoria,
        accion,
        origen_tabla,
        origen_id,
        payload,
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
        p_sesion_id,
        v_categoria,
        v_accion,
        nullif(trim(coalesce(p_origen_tabla, '')), ''),
        p_origen_id,
        p_payload,
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

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.registrar_log_mol_evento IS
    'Inserta un evento en el timeline MOL (log_mol_evento).';

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
    p_es_mock boolean DEFAULT false,
    p_sesion_id uuid DEFAULT NULL
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
    v_detalle_id uuid;
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
        es_mock,
        sesion_id
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
        COALESCE(p_es_mock, false),
        p_sesion_id
    )
    RETURNING id INTO v_detalle_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'tyc',
        v_accion,
        'log_mol_tyc_respuesta',
        v_detalle_id,
        jsonb_build_object(
            'codigo_tyc', v_codigo,
            'tyc_titulo', v_titulo,
            'tyc_updated_at', p_tyc_updated_at
        ),
        p_rut_alumno,
        p_codcli,
        p_nombre_alumno,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        p_es_mock
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_log_mol_contacto_otp(
    p_canal text,
    p_evento text,
    p_numero_envio smallint DEFAULT NULL,
    p_contacto_mascara text DEFAULT NULL,
    p_rut_alumno text DEFAULT NULL,
    p_codcli text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_anio_periodo integer DEFAULT NULL,
    p_semestre_periodo integer DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_es_mock boolean DEFAULT false,
    p_sesion_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_canal text := nullif(trim(coalesce(p_canal, '')), '');
    v_evento text := nullif(trim(coalesce(p_evento, '')), '');
    v_detalle_id uuid;
BEGIN
    IF v_canal IS NULL OR v_canal NOT IN ('correo', 'telefono') THEN
        RAISE EXCEPTION 'canal inválido';
    END IF;
    IF v_evento IS NULL OR v_evento NOT IN (
        'envio', 'reenvio', 'verificar_ok', 'verificar_fallido', 'continuar_sin_otp'
    ) THEN
        RAISE EXCEPTION 'evento inválido';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.log_mol_contacto_otp (
        canal,
        evento,
        numero_envio,
        contacto_mascara,
        rut_alumno,
        codcli,
        nombre_alumno,
        anio_periodo,
        semestre_periodo,
        periodo_label,
        url_origen,
        es_mock,
        sesion_id
    )
    VALUES (
        v_canal,
        v_evento,
        p_numero_envio,
        nullif(trim(coalesce(p_contacto_mascara, '')), ''),
        nullif(trim(coalesce(p_rut_alumno, '')), ''),
        nullif(trim(coalesce(p_codcli, '')), ''),
        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
        p_anio_periodo,
        p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        nullif(trim(coalesce(p_url_origen, '')), ''),
        COALESCE(p_es_mock, false),
        p_sesion_id
    )
    RETURNING id INTO v_detalle_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'contacto_otp',
        v_evento,
        'log_mol_contacto_otp',
        v_detalle_id,
        jsonb_build_object(
            'canal', v_canal,
            'numero_envio', p_numero_envio,
            'contacto_mascara', nullif(trim(coalesce(p_contacto_mascara, '')), '')
        ),
        p_rut_alumno,
        p_codcli,
        p_nombre_alumno,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        p_es_mock
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_log_sesion(
    p_email text DEFAULT NULL,
    p_usuario_local text DEFAULT NULL,
    p_auth_source text DEFAULT NULL,
    p_mv_usuario_id uuid DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_email text := nullif(trim(coalesce(p_email, '')), '');
    v_local text := nullif(trim(coalesce(p_usuario_local, '')), '');
BEGIN
    IF p_auth_source IS NULL OR p_auth_source NOT IN ('mv_ldap', 'pixarron') THEN
        RAISE EXCEPTION 'auth_source inválido';
    END IF;
    IF v_email IS NULL OR v_local IS NULL THEN
        RAISE EXCEPTION 'email y usuario_local requeridos';
    END IF;
    IF length(v_email) > 512 OR length(v_local) > 512 THEN
        RAISE EXCEPTION 'longitud excedida';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;
    IF p_user_agent IS NOT NULL AND length(p_user_agent) > 1024 THEN
        RAISE EXCEPTION 'user_agent demasiado largo';
    END IF;

    INSERT INTO public.log_sesion_usuario (
        email,
        usuario_local,
        auth_source,
        mv_usuario_id,
        url_origen,
        user_agent
    )
    VALUES (
        v_email,
        v_local,
        p_auth_source,
        p_mv_usuario_id,
        nullif(trim(coalesce(p_url_origen, '')), ''),
        nullif(trim(coalesce(p_user_agent, '')), '')
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        v_id,
        'sesion',
        'inicio',
        'log_sesion_usuario',
        v_id,
        jsonb_build_object(
            'email', v_email,
            'usuario_local', v_local,
            'auth_source', p_auth_source
        ),
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        p_url_origen,
        false
    );

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cerrar_log_sesion(
    p_session_id uuid,
    p_motivo text DEFAULT 'logout'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
BEGIN
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'session_id requerido';
    END IF;
    IF v_motivo IS NULL OR v_motivo NOT IN ('logout', 'beacon', 'timeout') THEN
        RAISE EXCEPTION 'motivo inválido';
    END IF;

    UPDATE public.log_sesion_usuario
    SET
        fin_en = COALESCE(fin_en, now()),
        duracion_segundos = COALESCE(
            duracion_segundos,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - inicio_en))))::integer
        ),
        motivo_cierre = COALESCE(motivo_cierre, v_motivo)
    WHERE id = p_session_id
      AND fin_en IS NULL;

    PERFORM public.registrar_log_mol_evento(
        p_session_id,
        'sesion',
        'cierre',
        'log_sesion_usuario',
        p_session_id,
        jsonb_build_object('motivo', v_motivo),
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        false
    );
END;
$$;

CREATE OR REPLACE VIEW public.v_log_mol_sesion_timeline AS
SELECT
    e.id,
    e.sesion_id,
    e.categoria,
    e.accion,
    e.creado_en,
    (e.creado_en AT TIME ZONE 'America/Santiago') AS creado_en_santiago,
    to_char(e.creado_en AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI:SS') AS creado_en_chile_txt,
    e.rut_alumno,
    e.codcli,
    e.nombre_alumno,
    e.es_mock,
    e.payload,
    e.origen_tabla,
    e.origen_id,
    e.anio_periodo,
    e.semestre_periodo,
    e.periodo_label,
    e.url_origen
FROM public.log_mol_evento e;

COMMENT ON VIEW public.v_log_mol_sesion_timeline IS
    'Timeline MOL con timestamps en zona America/Santiago para consulta de soporte.';

GRANT EXECUTE ON FUNCTION public.registrar_log_mol_evento(
    uuid, text, text, text, uuid, jsonb, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_log_mol_tyc_respuesta(
    text, text, timestamptz, text, text, text, text, integer, integer, text, text, boolean, uuid
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_log_mol_contacto_otp(
    text, text, smallint, text, text, text, text, integer, integer, text, text, boolean, uuid
) TO anon, authenticated;
