BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.mnp_retencion_etapa_control (
 anio_periodo integer NOT NULL CHECK(anio_periodo=2027),
 semestre_periodo smallint NOT NULL CHECK(semestre_periodo=1),
 modo text NOT NULL DEFAULT 'legacy' CHECK(modo IN ('legacy','etapas','bloqueado')),
 snapshot_version uuid, snapshot_en timestamptz, snapshot_filas integer,
 snapshot_valido boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(anio_periodo,semestre_periodo),
 CHECK(NOT snapshot_valido OR (snapshot_version IS NOT NULL AND snapshot_en IS NOT NULL AND snapshot_filas>0))
);
CREATE TABLE public.mnp_retencion_etapa_legacy (
 legacy_id uuid PRIMARY KEY, codcli text, anio_periodo integer NOT NULL, semestre_periodo smallint NOT NULL,
 canal text NOT NULL CHECK(canal IN ('correo','sms')), estado_legacy text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('pendiente','equivalente','incierto','sin_match','ignorado')),
 diagnostico text NOT NULL CHECK(diagnostico ~ '^[A-Z0-9_]{1,64}$'),
 -- Manual verified never-attempted evidence includes the exact original row and audit reference.
 no_intentado_evidencia jsonb CHECK(no_intentado_evidencia IS NULL OR jsonb_typeof(no_intentado_evidencia)='object'),
 sent_at timestamptz, provider_id text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mnp_ret_etapa_legacy_caso ON public.mnp_retencion_etapa_legacy(codcli,anio_periodo,semestre_periodo) WHERE decision IN ('incierto','sin_match');
ALTER TABLE public.mnp_retencion_etapa_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnp_retencion_etapa_legacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mnp_retencion_etapa_control,public.mnp_retencion_etapa_legacy FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mnp_retencion_etapa_control,public.mnp_retencion_etapa_legacy TO service_role;
-- No flags, mode latch or communications are seeded by this migration.
COMMIT;
