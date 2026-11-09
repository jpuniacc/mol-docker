BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.mnp_retencion_etapa_auditoria (
 outbox_id uuid PRIMARY KEY REFERENCES public.mnp_retencion_etapa_outbox(id),
 asunto text, destinatario text NOT NULL, cc text,
 preparado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.mnp_retencion_etapa_lectura_config (
 anio_periodo integer NOT NULL, semestre_periodo smallint NOT NULL CHECK(semestre_periodo IN (1,2)),
 instrumentacion_desde timestamptz NOT NULL,
 PRIMARY KEY(anio_periodo,semestre_periodo)
);
-- A real observation starts coverage; do not seed a fictional historical start at migration time.
CREATE FUNCTION public.registrar_inicio_recordatorios_etapa() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 INSERT INTO public.mnp_retencion_etapa_lectura_config(anio_periodo,semestre_periodo,instrumentacion_desde)
 VALUES(NEW.anio_periodo,NEW.semestre_periodo,NEW.observado_en) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_inicio_recordatorios_etapa() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER registrar_inicio_recordatorios_etapa AFTER INSERT OR UPDATE ON public.mnp_retencion_etapa_observacion FOR EACH ROW EXECUTE FUNCTION public.registrar_inicio_recordatorios_etapa();
CREATE INDEX mnp_ret_etapa_avance_caso ON public.mnp_retencion_etapa_avance(codcli,anio_periodo,semestre_periodo,avance_en,detectado_en);
ALTER TABLE public.mnp_retencion_etapa_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_retencion_etapa_lectura_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mnp_retencion_etapa_auditoria,public.mnp_retencion_etapa_lectura_config FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mnp_retencion_etapa_auditoria,public.mnp_retencion_etapa_lectura_config TO service_role;
-- No flags, no recipients seeded, no sends, no live refresh.
COMMIT;
