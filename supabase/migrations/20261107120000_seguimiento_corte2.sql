-- CORTE 2: firma ejecutivo (solo service_role) + escritura outbox retención.
-- Solo supabase-dev / mol-dev hasta OK explícito de prod.

CREATE TABLE IF NOT EXISTS public.mnp_ejecutivo_firma (
  email text PRIMARY KEY,
  mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  bytes bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnp_ejecutivo_firma_size_chk CHECK (octet_length(bytes) <= 512000)
);

COMMENT ON TABLE public.mnp_ejecutivo_firma IS
  'Firma imagen del ejecutivo para composers seguimiento. Solo service_role (API); no anon/authenticated.';

GRANT SELECT, INSERT, UPDATE ON public.mnp_ejecutivo_firma TO service_role;
-- Revocar defaults de Supabase (anon key vive en el front).
REVOKE ALL ON public.mnp_ejecutivo_firma FROM anon, authenticated;

GRANT INSERT, UPDATE ON public.mnp_retencion_outbox TO service_role;
