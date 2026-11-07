-- Cierra acceso cliente (anon/authenticated) a tablas internas; la API usa postgres (BYPASSRLS).
-- Rollback: ver backups/nota-v2-20261107/PROPUESTA-RLS.sql (bloque REVERTIR).
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.mnp_seguimiento_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_retencion_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.mnp_seguimiento_contacto, public.mnp_retencion_outbox FROM anon, authenticated;
COMMIT;
