-- Aviso al aprobar o rechazar un certificado: consejero, mol@ y correo validado.

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_tipo_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_tipo_check
  CHECK (tipo IN (
    'TYC_RECHAZO',
    'CONVENIO_CERTIFICADO',
    'CONVENIO_CERTIFICADO_APROBADO',
    'CONVENIO_CERTIFICADO_RECHAZADO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA'
  ));

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
        INSERT INTO public.mnp_aviso_consejero (
            tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
            caso_id, ref_id, payload, estado, es_mock
        ) VALUES (
            v_tipo_aviso,
            v_row.periodo,
            v_row.codcli,
            v_row.rut_alumno,
            v_row.nombre_alumno,
            v_row.carrera,
            v_row.jornada,
            v_row.id,
            v_row.ref_id,
            coalesce(v_row.payload, '{}'::jsonb) || jsonb_build_object(
                'motivo', nullif(trim(coalesce(p_motivo, '')), ''),
                'resolucion', v_estado
            ),
            'pendiente',
            false
        );
    END IF;

    RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.resolver_mnp_caso_rematricula(uuid, text, text, text) IS
  'Cierra el caso. Si es un certificado aprobado o rechazado, encola aviso al consejero, mol@ y al correo validado del alumno.';
