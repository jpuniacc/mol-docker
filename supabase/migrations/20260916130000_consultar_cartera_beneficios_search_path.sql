-- Harden SECURITY DEFINER RPC: fijar search_path
CREATE OR REPLACE FUNCTION public.consultar_cartera_beneficios(
    p_periodo text,
    p_codcli_excel text DEFAULT NULL,
    p_rut_norm text DEFAULT NULL
)
RETURNS SETOF public.mnp_cartera_beneficios
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.mnp_cartera_beneficios
    WHERE periodo = p_periodo
      AND (
          (p_codcli_excel IS NOT NULL AND codcli_excel = p_codcli_excel)
          OR (p_codcli_excel IS NULL AND p_rut_norm IS NOT NULL AND rut_norm = p_rut_norm)
      );
$$;
