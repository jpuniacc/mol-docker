-- Outbox avisos email al consejero + email_ejecutivo en cartera.

ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS email_ejecutivo text;
COMMENT ON COLUMN public.mnp_cartera_oficial.email_ejecutivo IS
  'EJECUTIVO MATRICULA del Excel (lower). Destinatario To de avisos.';

CREATE TABLE IF NOT EXISTS public.mnp_aviso_consejero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN (
    'TYC_RECHAZO', 'CONVENIO_CERTIFICADO', 'APODERADO_DATOS', 'FIRMA_COMPLETA'
  )),
  periodo text NOT NULL,
  codcli text NOT NULL,
  rut_alumno text,
  nombre_alumno text,
  carrera text,
  jornada text,
  caso_id uuid REFERENCES public.mnp_caso_rematricula(id),
  ref_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'error', 'omitido')),
  intentos integer NOT NULL DEFAULT 0,
  ultimo_error text,
  enviado_en timestamptz,
  es_mock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_una_vez
  ON public.mnp_aviso_consejero (tipo, periodo, codcli)
  WHERE tipo IN ('TYC_RECHAZO', 'APODERADO_DATOS', 'FIRMA_COMPLETA');

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_convenio_ref
  ON public.mnp_aviso_consejero (tipo, periodo, codcli, ref_id)
  WHERE tipo = 'CONVENIO_CERTIFICADO';

CREATE INDEX IF NOT EXISTS idx_mnp_aviso_pendiente
  ON public.mnp_aviso_consejero (estado, created_at)
  WHERE estado IN ('pendiente', 'error');

ALTER TABLE public.mnp_aviso_consejero ENABLE ROW LEVEL SECURITY;
-- sin policies SELECT/WRITE para anon/authenticated
GRANT SELECT, INSERT, UPDATE ON public.mnp_aviso_consejero TO service_role;

CREATE TABLE IF NOT EXISTS public.mnp_aviso_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_chile date NOT NULL,
  ventana text NOT NULL CHECK (ventana IN ('09', '16')),
  email_ejecutivo text NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  n_items integer NOT NULL DEFAULT 0,
  UNIQUE (fecha_chile, ventana, email_ejecutivo)
);
ALTER TABLE public.mnp_aviso_digest_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.mnp_aviso_digest_log TO service_role;

DROP FUNCTION IF EXISTS public.abrir_mnp_caso_rematricula(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.abrir_mnp_caso_rematricula(
    p_periodo text,
    p_tipo text,
    p_estado text,
    p_codcli text,
    p_titulo text,
    p_rut_alumno text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_carrera text DEFAULT NULL,
    p_jornada text DEFAULT NULL,
    p_detalle text DEFAULT NULL,
    p_ref_tipo text DEFAULT NULL,
    p_ref_id text DEFAULT NULL,
    p_es_mock boolean DEFAULT false,
    p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_estado text := coalesce(nullif(trim(p_estado), ''), 'EN_REVISION');
    v_tipo text := trim(p_tipo);
BEGIN
    IF nullif(trim(p_periodo), '') IS NULL OR nullif(trim(p_tipo), '') IS NULL
       OR nullif(trim(p_codcli), '') IS NULL OR nullif(trim(p_titulo), '') IS NULL THEN
        RAISE EXCEPTION 'periodo, tipo, codcli y titulo son requeridos';
    END IF;

    SELECT id INTO v_id
    FROM public.mnp_caso_rematricula
    WHERE periodo = trim(p_periodo)
      AND tipo = v_tipo
      AND codcli = trim(p_codcli)
      AND estado IN ('ABIERTO', 'EN_REVISION')
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_id IS NULL THEN
        SELECT id INTO v_id
        FROM public.mnp_caso_rematricula
        WHERE periodo = trim(p_periodo)
          AND tipo = v_tipo
          AND codcli = trim(p_codcli)
          AND estado = 'RECHAZADO'
        ORDER BY updated_at DESC
        LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
        UPDATE public.mnp_caso_rematricula
        SET estado = v_estado,
            rut_alumno = coalesce(nullif(trim(p_rut_alumno), ''), rut_alumno),
            nombre_alumno = coalesce(nullif(trim(p_nombre_alumno), ''), nombre_alumno),
            carrera = coalesce(nullif(trim(p_carrera), ''), carrera),
            jornada = coalesce(nullif(trim(p_jornada), ''), jornada),
            titulo = trim(p_titulo),
            detalle = p_detalle,
            ref_tipo = p_ref_tipo,
            ref_id = p_ref_id,
            payload = coalesce(p_payload, '{}'::jsonb),
            resuelto_por = NULL,
            resuelto_en = NULL,
            motivo = CASE WHEN v_estado = 'RECHAZADO' THEN motivo ELSE NULL END,
            updated_at = now()
        WHERE id = v_id;
    ELSE
        INSERT INTO public.mnp_caso_rematricula (
            periodo, tipo, estado, rut_alumno, codcli, nombre_alumno, carrera, jornada,
            titulo, detalle, ref_tipo, ref_id, payload
        ) VALUES (
            trim(p_periodo), v_tipo, v_estado,
            nullif(trim(p_rut_alumno), ''),
            trim(p_codcli),
            nullif(trim(p_nombre_alumno), ''),
            nullif(trim(p_carrera), ''),
            nullif(trim(p_jornada), ''),
            trim(p_titulo),
            p_detalle,
            p_ref_tipo,
            p_ref_id,
            coalesce(p_payload, '{}'::jsonb)
        )
        RETURNING id INTO v_id;
    END IF;

    IF v_tipo IN ('TYC_RECHAZO', 'CONVENIO_CERTIFICADO', 'APODERADO_DATOS')
       AND p_es_mock IS NOT TRUE THEN
        IF v_tipo = 'CONVENIO_CERTIFICADO' THEN
            INSERT INTO public.mnp_aviso_consejero (
                tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
                caso_id, ref_id, payload, estado, es_mock
            ) VALUES (
                v_tipo, trim(p_periodo), trim(p_codcli),
                nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
                nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
                v_id, p_ref_id, coalesce(p_payload, '{}'::jsonb),
                'pendiente', false
            )
            ON CONFLICT (tipo, periodo, codcli, ref_id)
                WHERE (tipo = 'CONVENIO_CERTIFICADO')
            DO NOTHING;
        ELSE
            INSERT INTO public.mnp_aviso_consejero (
                tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
                caso_id, ref_id, payload, estado, es_mock
            ) VALUES (
                v_tipo, trim(p_periodo), trim(p_codcli),
                nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
                nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
                v_id, p_ref_id, coalesce(p_payload, '{}'::jsonb),
                'pendiente', false
            )
            ON CONFLICT (tipo, periodo, codcli)
                WHERE (tipo IN ('TYC_RECHAZO', 'APODERADO_DATOS', 'FIRMA_COMPLETA'))
            DO NOTHING;
        END IF;
    END IF;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_mnp_caso_rematricula(
    text, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.encolar_mnp_aviso_firma_completa(
  p_periodo text,
  p_codcli text,
  p_rut_alumno text DEFAULT NULL,
  p_nombre_alumno text DEFAULT NULL,
  p_carrera text DEFAULT NULL,
  p_jornada text DEFAULT NULL,
  p_ref_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.mnp_aviso_consejero (
    tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    ref_id, payload, estado, es_mock
  ) VALUES (
    'FIRMA_COMPLETA', trim(p_periodo), trim(p_codcli),
    nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
    nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
    p_ref_id, coalesce(p_payload, '{}'::jsonb), 'pendiente', false
  )
  ON CONFLICT (tipo, periodo, codcli)
      WHERE (tipo IN ('TYC_RECHAZO', 'APODERADO_DATOS', 'FIRMA_COMPLETA'))
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.encolar_mnp_aviso_firma_completa TO service_role;
