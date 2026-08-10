-- Reintento correo tras 3 intentos incorrectos (segundos).

ALTER TABLE public.tp_contacto_otp_config
    ADD COLUMN IF NOT EXISTS otp_email_reintento_segundos integer NOT NULL DEFAULT 30;

ALTER TABLE public.tp_contacto_otp_config
    DROP CONSTRAINT IF EXISTS tp_contacto_otp_config_otp_email_reintento_segundos_check;

ALTER TABLE public.tp_contacto_otp_config
    ADD CONSTRAINT tp_contacto_otp_config_otp_email_reintento_segundos_check
    CHECK (otp_email_reintento_segundos BETWEEN 5 AND 600);

COMMENT ON COLUMN public.tp_contacto_otp_config.otp_email_reintento_segundos IS
    'Segundos de espera tras 3 intentos incorrectos de OTP correo antes de poder reenviar.';

UPDATE public.tp_contacto_otp_config
SET otp_email_reintento_segundos = 30
WHERE codigo = 'mol';
