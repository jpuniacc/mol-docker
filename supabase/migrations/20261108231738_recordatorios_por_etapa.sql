-- A+B only. Additive, no scheduler, no flags, no legacy mutation, no queued sends.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.mnp_retencion_etapa_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codcli text NOT NULL CHECK (codcli <> '' AND codcli = btrim(codcli)),
  rut_norm text NOT NULL CHECK (rut_norm <> ''),
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK (semestre_periodo IN (1,2)),
  etapa text NOT NULL CHECK (etapa IN ('ingreso','tyc','datos','forma_pago')),
  canal text NOT NULL CHECK (canal IN ('correo','sms')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesando','enviado','cancelado','error')),
  etapa_desde timestamptz NOT NULL, due_at timestamptz NOT NULL,
  sent_at timestamptz, cancelado_at timestamptz,
  correo_origen_id uuid,
  template_version text NOT NULL, variante text NOT NULL,
  origen text NOT NULL DEFAULT 'etapa' CHECK (origen IN ('etapa','legacy')),
  ejecutivo_email text, provider_id text,
  intentos integer NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 3),
  ultimo_intento_at timestamptz, next_retry_at timestamptz,
  error_codigo text CHECK (error_codigo IS NULL OR error_codigo ~ '^[A-Z0-9_]{1,64}$'),
  cancelacion_motivo text,
  claim_token uuid, claimed_at timestamptz,
  resultado_incierto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codcli,anio_periodo,semestre_periodo,etapa,canal),
  UNIQUE (id,codcli,anio_periodo,semestre_periodo,etapa),
  FOREIGN KEY (correo_origen_id,codcli,anio_periodo,semestre_periodo,etapa)
    REFERENCES public.mnp_retencion_etapa_outbox(id,codcli,anio_periodo,semestre_periodo,etapa),
  CHECK ((canal='sms' AND correo_origen_id IS NOT NULL) OR (canal='correo' AND correo_origen_id IS NULL)),
  CHECK ((estado='enviado') = (sent_at IS NOT NULL)),
  CHECK (estado <> 'enviado' OR (provider_id IS NOT NULL AND btrim(provider_id) <> '')),
  CHECK ((estado='procesando') = (claim_token IS NOT NULL AND claimed_at IS NOT NULL)),
  CHECK (estado='procesando' OR (claim_token IS NULL AND claimed_at IS NULL)),
  CHECK (NOT resultado_incierto OR estado IN ('error','cancelado')),
  CHECK (due_at >= etapa_desde),
  CHECK (sent_at IS NULL OR sent_at >= etapa_desde)
);
CREATE INDEX mnp_ret_etapa_dispatch ON public.mnp_retencion_etapa_outbox(due_at,id)
  WHERE estado='pendiente' OR (estado='error' AND next_retry_at IS NOT NULL AND NOT resultado_incierto);
CREATE INDEX mnp_ret_etapa_rut ON public.mnp_retencion_etapa_outbox(rut_norm,anio_periodo,semestre_periodo);
CREATE INDEX mnp_ret_etapa_metricas ON public.mnp_retencion_etapa_outbox(anio_periodo,semestre_periodo,etapa,estado,sent_at);
CREATE INDEX mnp_ret_etapa_parent ON public.mnp_retencion_etapa_outbox(correo_origen_id) WHERE correo_origen_id IS NOT NULL;
-- Invoker only, no privileged public RPC; validates cross-row origin and immutable receipts.
CREATE FUNCTION public.validar_mnp_retencion_etapa_outbox() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE correo public.mnp_retencion_etapa_outbox;
BEGIN
  IF TG_OP='UPDATE' AND OLD.estado='enviado' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'sent_receipt_immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.canal='sms' THEN
    SELECT * INTO correo FROM public.mnp_retencion_etapa_outbox WHERE id=NEW.correo_origen_id FOR KEY SHARE;
    IF NOT FOUND OR correo.canal<>'correo' OR correo.estado<>'enviado'
      OR correo.resultado_incierto OR correo.sent_at IS NULL
      OR (correo.codcli,correo.anio_periodo,correo.semestre_periodo,correo.etapa,correo.etapa_desde)
         IS DISTINCT FROM (NEW.codcli,NEW.anio_periodo,NEW.semestre_periodo,NEW.etapa,NEW.etapa_desde)
      OR NEW.due_at <> correo.sent_at + interval '48 hours' THEN
      RAISE EXCEPTION 'sms_requires_real_same_stage_email' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_mnp_retencion_etapa_outbox() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validar_mnp_retencion_etapa_outbox BEFORE INSERT OR UPDATE
ON public.mnp_retencion_etapa_outbox FOR EACH ROW EXECUTE FUNCTION public.validar_mnp_retencion_etapa_outbox();
CREATE TABLE public.mnp_retencion_etapa_observacion (
  codcli text NOT NULL, anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK(semestre_periodo IN (1,2)),
  etapa text NOT NULL, etapa_desde timestamptz NOT NULL, observado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(codcli,anio_periodo,semestre_periodo)
);
CREATE TABLE public.mnp_retencion_etapa_avance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codcli text NOT NULL,
  anio_periodo integer NOT NULL, semestre_periodo smallint NOT NULL CHECK(semestre_periodo IN (1,2)),
  etapa_origen text NOT NULL, etapa_destino text NOT NULL, etapa_origen_desde timestamptz NOT NULL,
  detectado_en timestamptz NOT NULL DEFAULT now(), avance_en timestamptz,
  fuente text NOT NULL CHECK(fuente IN ('snapshot_confirmado','legacy_conciliado')),
  UNIQUE(codcli,anio_periodo,semestre_periodo,etapa_origen,etapa_origen_desde,etapa_destino)
);
CREATE INDEX mnp_ret_etapa_avance_metrica ON public.mnp_retencion_etapa_avance(anio_periodo,semestre_periodo,etapa_origen,detectado_en);
ALTER TABLE public.mnp_retencion_etapa_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_retencion_etapa_observacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_retencion_etapa_avance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mnp_retencion_etapa_outbox,public.mnp_retencion_etapa_observacion,public.mnp_retencion_etapa_avance FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mnp_retencion_etapa_outbox,public.mnp_retencion_etapa_observacion,public.mnp_retencion_etapa_avance TO service_role;
COMMIT;
