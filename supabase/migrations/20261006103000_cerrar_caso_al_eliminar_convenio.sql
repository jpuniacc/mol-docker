-- Al eliminar el certificado, el caso abierto deja de estar en revisión.
-- Si el alumno vuelve a subir, abrir_mnp_caso_rematricula crea uno nuevo.

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
          );

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
    'Marca el documento como eliminado, cierra el caso de certificado en revisión y registra el evento.';

-- Casos que ya quedaron en revisión con el archivo borrado.
UPDATE public.mnp_caso_rematricula AS c
SET estado = 'CERRADO',
    resuelto_por = 'alumno',
    resuelto_en = now(),
    motivo = 'El alumno eliminó el documento',
    detalle = 'El alumno eliminó el documento de vigencia. No queda archivo para revisar.',
    updated_at = now()
WHERE c.tipo = 'CONVENIO_CERTIFICADO'
  AND c.estado IN ('ABIERTO', 'EN_REVISION')
  AND EXISTS (
    SELECT 1
    FROM public.mnp_convenio_documento AS d
    WHERE d.eliminado_en IS NOT NULL
      AND (
        c.ref_id = d.id::text
        OR c.ref_id = d.storage_path
        OR c.payload->>'storage_path' = d.storage_path
      )
  );
