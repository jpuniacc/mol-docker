-- Casos genéricos de rematrícula (convenio certificado, apoderado, CAE).

CREATE TABLE IF NOT EXISTS public.mnp_caso_rematricula (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo text NOT NULL
        CHECK (periodo ~ '^\d{4}-0[12]$'),
    tipo text NOT NULL
        CHECK (tipo IN ('CONVENIO_CERTIFICADO', 'APODERADO_DATOS', 'CAE_RESOLUCION')),
    estado text NOT NULL
        CHECK (estado IN ('ABIERTO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'CERRADO')),
    rut_alumno text,
    codcli text NOT NULL,
    nombre_alumno text,
    carrera text,
    jornada text,
    titulo text NOT NULL,
    detalle text,
    ref_tipo text
        CHECK (ref_tipo IS NULL OR ref_tipo IN ('convenio_documento', 'log_evento', 'verificacion_cae')),
    ref_id text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    resuelto_por text,
    resuelto_en timestamptz,
    motivo text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_caso_rematricula_periodo_estado
    ON public.mnp_caso_rematricula (periodo, estado, tipo);

CREATE INDEX IF NOT EXISTS idx_mnp_caso_rematricula_codcli
    ON public.mnp_caso_rematricula (codcli, periodo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mnp_caso_rematricula_abierto
    ON public.mnp_caso_rematricula (periodo, tipo, codcli)
    WHERE estado IN ('ABIERTO', 'EN_REVISION');

COMMENT ON TABLE public.mnp_caso_rematricula IS
    'Bandeja de casos de rematrícula para consejero (certificado convenio, apoderado, CAE).';

ALTER TABLE public.mnp_caso_rematricula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_caso_rematricula_no_select ON public.mnp_caso_rematricula;
CREATE POLICY mnp_caso_rematricula_no_select ON public.mnp_caso_rematricula
    FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS mnp_caso_rematricula_no_write ON public.mnp_caso_rematricula;
CREATE POLICY mnp_caso_rematricula_no_write ON public.mnp_caso_rematricula
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

GRANT SELECT ON public.mnp_caso_rematricula TO service_role;

-- Signed-url / listado de PDF desde dashboard (anon key + usuario autenticado MOL).
DROP POLICY IF EXISTS convenio_documentos_select ON storage.objects;
CREATE POLICY convenio_documentos_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'convenio-documentos');

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
BEGIN
    IF nullif(trim(p_periodo), '') IS NULL OR nullif(trim(p_tipo), '') IS NULL
       OR nullif(trim(p_codcli), '') IS NULL OR nullif(trim(p_titulo), '') IS NULL THEN
        RAISE EXCEPTION 'periodo, tipo, codcli y titulo son requeridos';
    END IF;

    SELECT id INTO v_id
    FROM public.mnp_caso_rematricula
    WHERE periodo = trim(p_periodo)
      AND tipo = trim(p_tipo)
      AND codcli = trim(p_codcli)
      AND estado IN ('ABIERTO', 'EN_REVISION')
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_id IS NULL THEN
        SELECT id INTO v_id
        FROM public.mnp_caso_rematricula
        WHERE periodo = trim(p_periodo)
          AND tipo = trim(p_tipo)
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
        RETURN v_id;
    END IF;

    INSERT INTO public.mnp_caso_rematricula (
        periodo, tipo, estado, rut_alumno, codcli, nombre_alumno, carrera, jornada,
        titulo, detalle, ref_tipo, ref_id, payload
    ) VALUES (
        trim(p_periodo), trim(p_tipo), v_estado,
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

    RETURN v_id;
END;
$$;

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
    v_row public.mnp_caso_rematricula%ROWTYPE;
    v_estado text := upper(trim(p_estado));
BEGIN
    IF v_estado NOT IN ('APROBADO', 'RECHAZADO') THEN
        RAISE EXCEPTION 'estado de resolución inválido';
    END IF;
    IF v_estado = 'RECHAZADO' AND nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
        RAISE EXCEPTION 'motivo requerido al rechazar';
    END IF;

    UPDATE public.mnp_caso_rematricula
    SET estado = v_estado,
        resuelto_por = nullif(trim(p_resuelto_por), ''),
        resuelto_en = now(),
        motivo = nullif(trim(coalesce(p_motivo, '')), ''),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'caso no encontrado';
    END IF;
    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_mnp_casos_rematricula(
    p_periodo text DEFAULT NULL,
    p_tipo text DEFAULT NULL,
    p_estado text DEFAULT NULL
)
RETURNS SETOF public.mnp_caso_rematricula
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.mnp_caso_rematricula
    WHERE (p_periodo IS NULL OR periodo = p_periodo)
      AND (p_tipo IS NULL OR tipo = p_tipo)
      AND (p_estado IS NULL OR estado = p_estado)
    ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.consultar_casos_alumno(
    p_codcli text,
    p_periodo text
)
RETURNS SETOF public.mnp_caso_rematricula
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.mnp_caso_rematricula
    WHERE codcli = trim(p_codcli)
      AND periodo = trim(p_periodo)
    ORDER BY updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_mnp_caso_rematricula(
    text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolver_mnp_caso_rematricula(uuid, text, text, text)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_mnp_casos_rematricula(text, text, text)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_casos_alumno(text, text)
    TO anon, authenticated, service_role;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000040',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Casos rematrícula',
  'dashboard-casos-rematricula',
  'Inbox',
  31,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000040', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
