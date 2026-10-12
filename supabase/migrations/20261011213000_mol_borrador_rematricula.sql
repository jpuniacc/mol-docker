-- Borrador del flujo de rematrícula del alumno. Una fila por alumno y periodo.

CREATE TABLE IF NOT EXISTS public.mol_borrador_rematricula (
  codcli text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  payload jsonb NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codcli, anio_periodo, semestre_periodo)
);

COMMENT ON TABLE public.mol_borrador_rematricula IS
  'Borrador del alumno en la rematrícula. Lo lee el propio flujo al entrar en otro navegador.';

ALTER TABLE public.mol_borrador_rematricula ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guardar_mol_borrador_rematricula(
  p_codcli text,
  p_anio_periodo integer,
  p_semestre_periodo integer,
  p_payload jsonb
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codcli text;
  v_en timestamptz;
BEGIN
  v_codcli := nullif(trim(coalesce(p_codcli, '')), '');
  IF v_codcli IS NULL OR p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN NULL;
  END IF;
  IF octet_length(p_payload::text) > 200000 THEN
    RETURN NULL;
  END IF;

  v_en := now();
  INSERT INTO public.mol_borrador_rematricula (
    codcli, anio_periodo, semestre_periodo, payload, actualizado_en
  )
  VALUES (v_codcli, p_anio_periodo, p_semestre_periodo, p_payload, v_en)
  ON CONFLICT (codcli, anio_periodo, semestre_periodo)
  DO UPDATE SET payload = EXCLUDED.payload, actualizado_en = EXCLUDED.actualizado_en;

  RETURN v_en;
END;
$$;

COMMENT ON FUNCTION public.guardar_mol_borrador_rematricula(text, integer, integer, jsonb) IS
  'Upsert del borrador de rematrícula del alumno. Devuelve actualizado_en.';

CREATE OR REPLACE FUNCTION public.consultar_mol_borrador_rematricula(
  p_codcli text,
  p_anio_periodo integer,
  p_semestre_periodo integer
)
RETURNS TABLE(payload jsonb, actualizado_en timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT b.payload, b.actualizado_en
  FROM public.mol_borrador_rematricula b
  WHERE b.codcli = nullif(trim(coalesce(p_codcli, '')), '')
    AND b.anio_periodo = p_anio_periodo
    AND b.semestre_periodo = p_semestre_periodo;
$$;

COMMENT ON FUNCTION public.consultar_mol_borrador_rematricula(text, integer, integer) IS
  'Lee el borrador de rematrícula del alumno en el periodo.';

GRANT EXECUTE ON FUNCTION public.guardar_mol_borrador_rematricula(text, integer, integer, jsonb)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.consultar_mol_borrador_rematricula(text, integer, integer)
  TO anon, authenticated, service_role;
