CREATE INDEX IF NOT EXISTS idx_log_mol_tyc_respuesta_alumno_periodo
    ON public.log_mol_tyc_respuesta (codcli, anio_periodo, semestre_periodo, codigo_tyc, creado_en DESC)
    WHERE codcli IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consultar_ultima_tyc_respuesta_alumno(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_codigo_tyc text DEFAULT 'mol'
)
RETURNS TABLE(accion text, tyc_updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT l.accion, l.tyc_updated_at
    FROM public.log_mol_tyc_respuesta l
    WHERE l.codcli = nullif(trim(coalesce(p_codcli, '')), '')
      AND l.anio_periodo = p_anio_periodo
      AND l.semestre_periodo = p_semestre_periodo
      AND l.codigo_tyc = coalesce(nullif(trim(coalesce(p_codigo_tyc, '')), ''), 'mol')
    ORDER BY l.creado_en DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.consultar_ultima_tyc_respuesta_alumno IS
    'Última aceptación o rechazo de TyC del alumno en el periodo.';

GRANT EXECUTE ON FUNCTION public.consultar_ultima_tyc_respuesta_alumno(
    text, integer, integer, text
) TO anon, authenticated, service_role;
