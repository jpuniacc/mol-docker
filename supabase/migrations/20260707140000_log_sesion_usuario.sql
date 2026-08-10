-- Duración de sesión de usuario (inicio + cierre logout/beacon).

CREATE TABLE IF NOT EXISTS public.log_sesion_usuario (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inicio_en timestamptz NOT NULL DEFAULT now(),
    fin_en timestamptz NULL,
    duracion_segundos integer NULL,
    motivo_cierre text NULL,
    email text NULL,
    usuario_local text NULL,
    auth_source text NULL,
    mv_usuario_id uuid NULL,
    url_origen text NULL,
    user_agent text NULL,
    CONSTRAINT log_sesion_usuario_motivo_cierre_chk
        CHECK (motivo_cierre IS NULL OR motivo_cierre IN ('logout', 'beacon', 'timeout')),
    CONSTRAINT fk_log_sesion_usuario_mv_usuario
        FOREIGN KEY (mv_usuario_id)
        REFERENCES public.mv_usuario (id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_log_sesion_usuario_inicio_en
    ON public.log_sesion_usuario (inicio_en DESC);

CREATE INDEX IF NOT EXISTS idx_log_sesion_usuario_abiertas
    ON public.log_sesion_usuario (inicio_en DESC)
    WHERE fin_en IS NULL;

COMMENT ON TABLE public.log_sesion_usuario IS
    'Sesiones activas/cerradas: inicio al login exitoso, cierre en logout o beacon al cerrar pestaña.';

ALTER TABLE public.log_sesion_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_sesion_usuario_no_select_anon ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_select_anon ON public.log_sesion_usuario
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS log_sesion_usuario_no_insert_anon ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_insert_anon ON public.log_sesion_usuario
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS log_sesion_usuario_no_update_anon ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_update_anon ON public.log_sesion_usuario
    FOR UPDATE TO anon USING (false);

DROP POLICY IF EXISTS log_sesion_usuario_no_select_authenticated ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_select_authenticated ON public.log_sesion_usuario
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS log_sesion_usuario_no_insert_authenticated ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_insert_authenticated ON public.log_sesion_usuario
    FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS log_sesion_usuario_no_update_authenticated ON public.log_sesion_usuario;
CREATE POLICY log_sesion_usuario_no_update_authenticated ON public.log_sesion_usuario
    FOR UPDATE TO authenticated USING (false);

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
END;
$$;

COMMENT ON FUNCTION public.iniciar_log_sesion IS
    'Abre sesión de auditoría; retorna UUID para persistir en cliente.';

COMMENT ON FUNCTION public.cerrar_log_sesion IS
    'Cierra sesión (idempotente si ya estaba cerrada).';

GRANT EXECUTE ON FUNCTION public.iniciar_log_sesion(text, text, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_log_sesion(uuid, text) TO anon, authenticated;
