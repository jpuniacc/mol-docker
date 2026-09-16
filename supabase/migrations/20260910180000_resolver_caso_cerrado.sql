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
    IF v_estado NOT IN ('APROBADO', 'RECHAZADO', 'CERRADO') THEN
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
