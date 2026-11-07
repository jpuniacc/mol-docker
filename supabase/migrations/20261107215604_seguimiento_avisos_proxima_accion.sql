-- Agenda interna de consejeros. Aditiva; no envía mensajes ni habilita scheduler.
SET lock_timeout='5s';
ALTER TABLE public.mnp_seguimiento_contacto
 ADD COLUMN IF NOT EXISTS proxima_accion_estado text NOT NULL DEFAULT 'pendiente'
   CHECK (proxima_accion_estado IN ('pendiente','completada','cancelada')),
 ADD COLUMN IF NOT EXISTS proxima_accion_gestionada_en timestamptz,
 ADD COLUMN IF NOT EXISTS proxima_accion_gestionada_por text,
 -- Las filas existentes nacen excluidas del digest; no se actualizan al reaplicar.
 ADD COLUMN IF NOT EXISTS proxima_accion_digest_habilitada boolean NOT NULL DEFAULT false;
ALTER TABLE public.mnp_seguimiento_contacto ALTER COLUMN proxima_accion_digest_habilitada SET DEFAULT true;
COMMENT ON COLUMN public.mnp_seguimiento_contacto.proxima_accion_digest_habilitada IS 'false para históricos al despliegue; solo nuevas acciones generan digest; todos cuentan en badge';
CREATE INDEX IF NOT EXISTS idx_seguimiento_agenda_pendiente
 ON public.mnp_seguimiento_contacto (anio_periodo,semestre_periodo,(coalesce(proxima_accion_at,proxima_accion_en)),codcli)
 WHERE proxima_accion_estado='pendiente' AND origen='manual';
ALTER TABLE public.mnp_seguimiento_contacto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mnp_seguimiento_contacto FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.mnp_seguimiento_aviso_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email_ejecutivo text NOT NULL CHECK (email_ejecutivo=lower(btrim(email_ejecutivo))),
 fecha_local date NOT NULL,
 tipo text NOT NULL DEFAULT 'proxima_accion_diaria' CHECK(tipo='proxima_accion_diaria'),
 anio_periodo integer NOT NULL,
 semestre_periodo smallint NOT NULL CHECK(semestre_periodo IN (1,2)),
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','procesando','enviado','error','cancelado','ambiguo')),
 intentos integer NOT NULL DEFAULT 0 CHECK(intentos>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(email_ejecutivo,fecha_local,tipo)
);
CREATE INDEX IF NOT EXISTS idx_seguimiento_aviso_claim
 ON public.mnp_seguimiento_aviso_outbox(fecha_local,next_attempt_at,created_at)
 WHERE estado IN ('pendiente','error');
ALTER TABLE public.mnp_seguimiento_aviso_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mnp_seguimiento_aviso_outbox FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.mnp_seguimiento_aviso_outbox IS 'Agenda interna: idempotencia diaria; ambiguo requiere revisión manual, nunca reenvío ciego';
