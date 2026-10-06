-- Correo del alumno separado del aviso al consejero (CC mol@).

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_tipo_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_tipo_check
  CHECK (tipo IN (
    'TYC_RECHAZO',
    'CONVENIO_CERTIFICADO',
    'CONVENIO_CERTIFICADO_ALUMNO',
    'CONVENIO_CERTIFICADO_APROBADO',
    'CONVENIO_CERTIFICADO_APROBADO_ALUMNO',
    'CONVENIO_CERTIFICADO_RECHAZADO',
    'CONVENIO_CERTIFICADO_RECHAZADO_ALUMNO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_convenio_alumno_ref
  ON public.mnp_aviso_consejero (tipo, periodo, codcli, ref_id)
  WHERE tipo = 'CONVENIO_CERTIFICADO_ALUMNO';

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
    v_es_mock boolean := coalesce(p_es_mock, false);
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

    IF v_tipo IN ('TYC_RECHAZO', 'CONVENIO_CERTIFICADO', 'APODERADO_DATOS') THEN
        IF v_tipo = 'CONVENIO_CERTIFICADO' THEN
            INSERT INTO public.mnp_aviso_consejero (
                tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
                caso_id, ref_id, payload, estado, es_mock
            ) VALUES (
                v_tipo, trim(p_periodo), trim(p_codcli),
                nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
                nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
                v_id, p_ref_id, coalesce(p_payload, '{}'::jsonb),
                'pendiente', v_es_mock
            )
            ON CONFLICT (tipo, periodo, codcli, ref_id)
                WHERE (tipo = 'CONVENIO_CERTIFICADO')
            DO NOTHING;

            INSERT INTO public.mnp_aviso_consejero (
                tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
                caso_id, ref_id, payload, estado, es_mock
            ) VALUES (
                'CONVENIO_CERTIFICADO_ALUMNO', trim(p_periodo), trim(p_codcli),
                nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
                nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
                v_id, p_ref_id, coalesce(p_payload, '{}'::jsonb),
                'pendiente', v_es_mock
            )
            ON CONFLICT (tipo, periodo, codcli, ref_id)
                WHERE (tipo = 'CONVENIO_CERTIFICADO_ALUMNO')
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
                'pendiente', v_es_mock
            )
            ON CONFLICT (tipo, periodo, codcli)
                WHERE (tipo IN ('TYC_RECHAZO', 'APODERADO_DATOS', 'FIRMA_COMPLETA'))
            DO NOTHING;
        END IF;
    END IF;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.abrir_mnp_caso_rematricula(
    text, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) IS
  'Abre/rehidrata caso rematrícula y encola aviso al consejero (también si p_es_mock). Consejero y mol@ reciben el aviso de bandeja. El alumno recibe un correo aparte.';

CREATE OR REPLACE FUNCTION public.resolver_mnp_caso_rematricula(
    p_id uuid,
    p_estado text,
    p_resuelto_por text,
    p_motivo text DEFAULT NULL
)
RETURNS public.mnp_caso_rematricula
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev public.mnp_caso_rematricula%ROWTYPE;
    v_row public.mnp_caso_rematricula%ROWTYPE;
    v_estado text := upper(trim(p_estado));
    v_tipo_aviso text;
    v_payload jsonb;
BEGIN
    IF v_estado NOT IN ('APROBADO', 'RECHAZADO', 'CERRADO') THEN
        RAISE EXCEPTION 'estado de resolución inválido';
    END IF;
    IF v_estado = 'RECHAZADO' AND nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
        RAISE EXCEPTION 'motivo requerido al rechazar';
    END IF;

    SELECT * INTO v_prev
    FROM public.mnp_caso_rematricula
    WHERE id = p_id
    FOR UPDATE;

    IF v_prev.id IS NULL THEN
        RAISE EXCEPTION 'caso no encontrado';
    END IF;

    UPDATE public.mnp_caso_rematricula
    SET estado = v_estado,
        resuelto_por = nullif(trim(p_resuelto_por), ''),
        resuelto_en = now(),
        motivo = nullif(trim(coalesce(p_motivo, '')), ''),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

    IF v_prev.estado IN ('ABIERTO', 'EN_REVISION')
       AND v_row.tipo = 'CONVENIO_CERTIFICADO'
       AND v_estado IN ('APROBADO', 'RECHAZADO') THEN
        v_tipo_aviso := CASE
            WHEN v_estado = 'APROBADO' THEN 'CONVENIO_CERTIFICADO_APROBADO'
            ELSE 'CONVENIO_CERTIFICADO_RECHAZADO'
        END;
        v_payload := coalesce(v_row.payload, '{}'::jsonb) || jsonb_build_object(
            'motivo', nullif(trim(coalesce(p_motivo, '')), ''),
            'resolucion', v_estado
        );
        INSERT INTO public.mnp_aviso_consejero (
            tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
            caso_id, ref_id, payload, estado, es_mock
        ) VALUES (
            v_tipo_aviso,
            v_row.periodo, v_row.codcli, v_row.rut_alumno, v_row.nombre_alumno,
            v_row.carrera, v_row.jornada, v_row.id, v_row.ref_id,
            v_payload, 'pendiente', false
        );
        INSERT INTO public.mnp_aviso_consejero (
            tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
            caso_id, ref_id, payload, estado, es_mock
        ) VALUES (
            v_tipo_aviso || '_ALUMNO',
            v_row.periodo, v_row.codcli, v_row.rut_alumno, v_row.nombre_alumno,
            v_row.carrera, v_row.jornada, v_row.id, v_row.ref_id,
            v_payload, 'pendiente', false
        );
    END IF;

    RETURN v_row;
END;
$$;

-- La subida de Catalina ya avisó al consejero. Encola el correo dirigido al alumno.
INSERT INTO public.mnp_aviso_consejero (
    tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    caso_id, ref_id, payload, estado, es_mock
)
SELECT
    'CONVENIO_CERTIFICADO_ALUMNO',
    periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    caso_id, ref_id, payload, 'pendiente', es_mock
FROM public.mnp_aviso_consejero
WHERE id = '2343467b-ebb5-4fc4-bc23-eac0d73d8764'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mnp_aviso_consejero b
    WHERE b.tipo = 'CONVENIO_CERTIFICADO_ALUMNO'
      AND b.periodo = mnp_aviso_consejero.periodo
      AND b.codcli = mnp_aviso_consejero.codcli
      AND b.ref_id IS NOT DISTINCT FROM mnp_aviso_consejero.ref_id
  );
