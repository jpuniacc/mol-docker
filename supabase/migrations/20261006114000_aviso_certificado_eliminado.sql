-- Al eliminar el certificado, avisar al consejero con copia a mol@.

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
    'CONVENIO_CERTIFICADO_ELIMINADO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA'
  ));

CREATE OR REPLACE FUNCTION public.eliminar_mnp_convenio_documento(
    p_storage_path text,
    p_sesion_id uuid DEFAULT NULL,
    p_rut_alumno text DEFAULT NULL,
    p_codcli text DEFAULT NULL,
    p_nombre_alumno text DEFAULT NULL,
    p_anio_periodo integer DEFAULT NULL,
    p_semestre_periodo integer DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_url_origen text DEFAULT NULL,
    p_es_mock boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_storage_path text := nullif(trim(coalesce(p_storage_path, '')), '');
    v_row public.mnp_convenio_documento%ROWTYPE;
    v_caso public.mnp_caso_rematricula%ROWTYPE;
    v_afectados integer := 0;
BEGIN
    IF v_storage_path IS NULL THEN
        RAISE EXCEPTION 'storage_path requerido';
    END IF;

    UPDATE public.mnp_convenio_documento
    SET eliminado_en = now()
    WHERE storage_path = v_storage_path
      AND eliminado_en IS NULL
    RETURNING * INTO v_row;

    GET DIAGNOSTICS v_afectados = ROW_COUNT;

    IF v_afectados > 0 THEN
        FOR v_caso IN
            UPDATE public.mnp_caso_rematricula
            SET estado = 'CERRADO',
                resuelto_por = 'alumno',
                resuelto_en = now(),
                motivo = 'El alumno eliminó el documento',
                detalle = 'El alumno eliminó el documento de vigencia. No queda archivo para revisar.',
                updated_at = now()
            WHERE tipo = 'CONVENIO_CERTIFICADO'
              AND estado IN ('ABIERTO', 'EN_REVISION')
              AND (
                ref_id = v_row.id::text
                OR ref_id = v_row.storage_path
                OR payload->>'storage_path' = v_row.storage_path
              )
            RETURNING *
        LOOP
            INSERT INTO public.mnp_aviso_consejero (
                tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
                caso_id, ref_id, payload, estado, es_mock
            ) VALUES (
                'CONVENIO_CERTIFICADO_ELIMINADO',
                v_caso.periodo,
                v_caso.codcli,
                coalesce(v_caso.rut_alumno, nullif(trim(p_rut_alumno), '')),
                coalesce(v_caso.nombre_alumno, nullif(trim(p_nombre_alumno), '')),
                v_caso.carrera,
                v_caso.jornada,
                v_caso.id,
                v_caso.ref_id,
                coalesce(v_caso.payload, '{}'::jsonb) || jsonb_build_object(
                    'nombre_archivo', v_row.nombre_archivo
                ),
                'pendiente',
                coalesce(p_es_mock, false)
            );
        END LOOP;

        PERFORM public.registrar_log_mol_evento(
            p_sesion_id,
            'convenio_documento',
            'elimina',
            'mnp_convenio_documento',
            v_row.id,
            jsonb_build_object(
                'convenio_id', v_row.convenio_id,
                'codigo_beneficio', v_row.codigo_beneficio,
                'estado_convenio', v_row.estado_convenio,
                'nombre_archivo', v_row.nombre_archivo
            ),
            p_rut_alumno,
            p_codcli,
            p_nombre_alumno,
            p_anio_periodo,
            p_semestre_periodo,
            p_periodo_label,
            p_url_origen,
            p_es_mock
        );
    END IF;

    RETURN v_afectados;
END;
$$;

COMMENT ON FUNCTION public.eliminar_mnp_convenio_documento IS
    'Marca el documento como eliminado, cierra el caso en revisión y encola aviso al consejero con copia a mol@.';
