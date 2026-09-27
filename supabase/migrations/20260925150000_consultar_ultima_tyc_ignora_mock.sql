-- TyC real del alumno: no saltar el paso por aceptaciones hechas en flujo mock (staff).
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
      AND COALESCE(l.es_mock, false) = false
    ORDER BY l.creado_en DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.consultar_ultima_tyc_respuesta_alumno IS
    'Última aceptación o rechazo de TyC del alumno en el periodo (solo registros no mock).';
