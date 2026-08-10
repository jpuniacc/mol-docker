-- Parámetros OTP contacto (correo/SMS) en segundos; documento único MOL.

CREATE TABLE IF NOT EXISTS public.tp_contacto_otp_config (
    id serial PRIMARY KEY,
    codigo text NOT NULL UNIQUE DEFAULT 'mol',
    otp_email_segundos integer NOT NULL,
    otp_sms_segundos integer NOT NULL,
    otp_sms_reintento_segundos integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (otp_email_segundos BETWEEN 30 AND 3600),
    CHECK (otp_sms_segundos BETWEEN 30 AND 3600),
    CHECK (otp_sms_reintento_segundos BETWEEN 5 AND 600)
);

COMMENT ON TABLE public.tp_contacto_otp_config IS
    'Configuración OTP contacto rematrícula: validez correo/SMS y bloqueo reintento SMS (segundos).';

CREATE OR REPLACE FUNCTION public.tp_contacto_otp_config_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tp_contacto_otp_config_updated_at ON public.tp_contacto_otp_config;
CREATE TRIGGER tr_tp_contacto_otp_config_updated_at
    BEFORE UPDATE ON public.tp_contacto_otp_config
    FOR EACH ROW
    EXECUTE FUNCTION public.tp_contacto_otp_config_touch_updated_at();

ALTER TABLE public.tp_contacto_otp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_contacto_otp_config_select ON public.tp_contacto_otp_config;
CREATE POLICY tp_contacto_otp_config_select ON public.tp_contacto_otp_config
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_contacto_otp_config_insert ON public.tp_contacto_otp_config;
CREATE POLICY tp_contacto_otp_config_insert ON public.tp_contacto_otp_config
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS tp_contacto_otp_config_update ON public.tp_contacto_otp_config;
CREATE POLICY tp_contacto_otp_config_update ON public.tp_contacto_otp_config
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tp_contacto_otp_config_delete ON public.tp_contacto_otp_config;
CREATE POLICY tp_contacto_otp_config_delete ON public.tp_contacto_otp_config
    FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_contacto_otp_config TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tp_contacto_otp_config_id_seq TO anon, authenticated, service_role;

INSERT INTO public.tp_contacto_otp_config (
    id,
    codigo,
    otp_email_segundos,
    otp_sms_segundos,
    otp_sms_reintento_segundos
)
VALUES (1, 'mol', 300, 300, 30)
ON CONFLICT (codigo) DO UPDATE SET
    otp_email_segundos = EXCLUDED.otp_email_segundos,
    otp_sms_segundos = EXCLUDED.otp_sms_segundos,
    otp_sms_reintento_segundos = EXCLUDED.otp_sms_reintento_segundos;

SELECT setval(
    pg_get_serial_sequence('public.tp_contacto_otp_config', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.tp_contacto_otp_config), 1)
);
