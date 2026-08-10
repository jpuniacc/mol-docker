-- Documento de vigencia de convenio subido por el alumno en el flujo MOL.
-- El archivo va a Storage (bucket privado convenio-documentos) y los metadatos
-- se registran vía RPC SECURITY DEFINER (patrón mnp_discapacidad_encuesta).
-- Requiere: registrar_log_mol_evento (20260707170000) y tp_mnp_convenio (20260708140000).

-- 1. Bucket privado de Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('convenio-documentos', 'convenio-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies de storage.objects acotadas al bucket.
--    El front usa anon key: se permite subir (insert); no se expone lectura/borrado a anon.
DROP POLICY IF EXISTS convenio_documentos_insert ON storage.objects;
CREATE POLICY convenio_documentos_insert ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'convenio-documentos');

-- 3. Tabla de metadatos del documento
CREATE TABLE IF NOT EXISTS public.mnp_convenio_documento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    convenio_id uuid NULL
        REFERENCES public.tp_mnp_convenio (id) ON DELETE SET NULL,
    codigo_beneficio text NULL,
    cod_beneficio_alumno text NULL,
    estado_convenio text NULL,
    storage_bucket text NOT NULL DEFAULT 'convenio-documentos',
    storage_path text NOT NULL,
    nombre_archivo text NULL,
    mime text NULL,
    tamano_bytes bigint NULL,
    sesion_id uuid NULL
        REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL,
    rut_alumno text NULL,
    codcli text NULL,
    nombre_alumno text NULL,
    anio_periodo integer NULL,
    semestre_periodo integer NULL,
    periodo_label text NULL,
    url_origen text NULL,
    es_mock boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mnp_convenio_documento_creado_en
    ON public.mnp_convenio_documento (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_convenio_documento_convenio
    ON public.mnp_convenio_documento (convenio_id)
    WHERE convenio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_convenio_documento_rut
    ON public.mnp_convenio_documento (rut_alumno)
    WHERE rut_alumno IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_convenio_documento_periodo
    ON public.mnp_convenio_documento (anio_periodo, semestre_periodo);

COMMENT ON TABLE public.mnp_convenio_documento IS
    'Documentos de vigencia de convenio subidos por el alumno en el flujo MOL (metadatos; archivo en Storage).';

ALTER TABLE public.mnp_convenio_documento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_convenio_documento_no_select_anon ON public.mnp_convenio_documento;
CREATE POLICY mnp_convenio_documento_no_select_anon ON public.mnp_convenio_documento
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_convenio_documento_no_insert_anon ON public.mnp_convenio_documento;
CREATE POLICY mnp_convenio_documento_no_insert_anon ON public.mnp_convenio_documento
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_convenio_documento_no_select_authenticated ON public.mnp_convenio_documento;
CREATE POLICY mnp_convenio_documento_no_select_authenticated ON public.mnp_convenio_documento
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_convenio_documento_no_insert_authenticated ON public.mnp_convenio_documento;
CREATE POLICY mnp_convenio_documento_no_insert_authenticated ON public.mnp_convenio_documento
    FOR INSERT TO authenticated WITH CHECK (false);

-- 4. RPC de registro de metadatos + evento en timeline MOL
CREATE OR REPLACE FUNCTION public.registrar_mnp_convenio_documento(
    p_storage_path text,
    p_convenio_id uuid DEFAULT NULL,
    p_codigo_beneficio text DEFAULT NULL,
    p_cod_beneficio_alumno text DEFAULT NULL,
    p_estado_convenio text DEFAULT NULL,
    p_nombre_archivo text DEFAULT NULL,
    p_mime text DEFAULT NULL,
    p_tamano_bytes bigint DEFAULT NULL,
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_storage_path text := nullif(trim(coalesce(p_storage_path, '')), '');
    v_id uuid;
BEGIN
    IF v_storage_path IS NULL THEN
        RAISE EXCEPTION 'storage_path requerido';
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.mnp_convenio_documento (
        convenio_id,
        codigo_beneficio,
        cod_beneficio_alumno,
        estado_convenio,
        storage_bucket,
        storage_path,
        nombre_archivo,
        mime,
        tamano_bytes,
        sesion_id,
        rut_alumno,
        codcli,
        nombre_alumno,
        anio_periodo,
        semestre_periodo,
        periodo_label,
        url_origen,
        es_mock
    )
    VALUES (
        p_convenio_id,
        nullif(trim(coalesce(p_codigo_beneficio, '')), ''),
        nullif(trim(coalesce(p_cod_beneficio_alumno, '')), ''),
        nullif(trim(coalesce(p_estado_convenio, '')), ''),
        'convenio-documentos',
        v_storage_path,
        nullif(trim(coalesce(p_nombre_archivo, '')), ''),
        nullif(trim(coalesce(p_mime, '')), ''),
        p_tamano_bytes,
        p_sesion_id,
        nullif(trim(coalesce(p_rut_alumno, '')), ''),
        nullif(trim(coalesce(p_codcli, '')), ''),
        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
        p_anio_periodo,
        p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        nullif(trim(coalesce(p_url_origen, '')), ''),
        COALESCE(p_es_mock, false)
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'convenio_documento',
        'sube',
        'mnp_convenio_documento',
        v_id,
        jsonb_build_object(
            'convenio_id', p_convenio_id,
            'codigo_beneficio', nullif(trim(coalesce(p_codigo_beneficio, '')), ''),
            'estado_convenio', nullif(trim(coalesce(p_estado_convenio, '')), ''),
            'nombre_archivo', nullif(trim(coalesce(p_nombre_archivo, '')), '')
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

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.registrar_mnp_convenio_documento IS
    'Registra metadatos del documento de vigencia de convenio y su evento en log_mol_evento.';

GRANT EXECUTE ON FUNCTION public.registrar_mnp_convenio_documento(
    text, uuid, text, text, text, text, text, bigint, uuid, text, text, text, integer, integer, text, text, boolean
) TO anon, authenticated;
