-- Auditoría de envíos/reintentos OTP contacto MOL (correo y teléfono).

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
    p_es_mock boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_canal text := nullif(trim(coalesce(p_canal, '')), '');
    v_evento text := nullif(trim(coalesce(p_evento, '')), '');
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
        es_mock
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
        COALESCE(p_es_mock, false)
    );
END;
$$;

COMMENT ON FUNCTION public.registrar_log_mol_contacto_otp IS
    'Registra eventos OTP de contacto (correo/teléfono) en flujo MOL.';

GRANT EXECUTE ON FUNCTION public.registrar_log_mol_contacto_otp(
    text, text, smallint, text, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;
