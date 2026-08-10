-- Permite al alumno eliminar el documento de vigencia que subió por error.
-- Se borra el archivo físico de Storage (policy DELETE acotada al bucket) y se
-- marca el metadato como eliminado (soft delete) para conservar la auditoría.
-- Requiere: 20260721120000_mnp_convenio_documento.sql

-- 1. Policies en storage.objects acotadas al bucket (el front usa anon key).
--    Para eliminar un objeto vía storage-api se requiere SELECT (para ubicarlo)
--    y DELETE (para borrarlo). Sin la de SELECT, remove() no encuentra el objeto
--    y termina sin borrar ni arrojar error.
DROP POLICY IF EXISTS convenio_documentos_select ON storage.objects;
CREATE POLICY convenio_documentos_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'convenio-documentos');

DROP POLICY IF EXISTS convenio_documentos_delete ON storage.objects;
CREATE POLICY convenio_documentos_delete ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'convenio-documentos');

-- 2. Soft delete en los metadatos (no se borra la fila para conservar el historial).
ALTER TABLE public.mnp_convenio_documento
    ADD COLUMN IF NOT EXISTS eliminado_en timestamptz NULL;

-- 3. RPC de eliminación: marca el metadato y registra el evento en el timeline MOL.
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
    'Marca como eliminado el documento de vigencia de convenio (soft delete) y registra el evento en log_mol_evento.';

GRANT EXECUTE ON FUNCTION public.eliminar_mnp_convenio_documento(
    text, uuid, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;
