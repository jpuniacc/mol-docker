-- Mock también encola aviso al consejero (To ejecutivo cartera, CC mol@).
-- es_mock se guarda en la fila del outbox solo como marca; no bloquea el envío.

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
  'Abre/rehidrata caso rematrícula y encola aviso al consejero (también si p_es_mock). Destino: email_ejecutivo cartera + CC mol@.';
