-- Canal de matrícula cartera (MOL vs Backoffice). Batch diario desde API.

CREATE TABLE IF NOT EXISTS public.mnp_matricula_cartera_canal (
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  codcli text NOT NULL,
  rut_norm text NOT NULL,
  canal text NOT NULL,
  fec_mat timestamptz NULL,
  usuario_mat text NULL,
  usuario_mat_nombre text NULL,
  codcarr text NULL,
  nombre_carrera text NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnp_matricula_cartera_canal_canal_check
    CHECK (canal IN ('MOL', 'BO')),
  CONSTRAINT mnp_matricula_cartera_canal_pk
    PRIMARY KEY (anio_periodo, semestre_periodo, codcli)
);

CREATE INDEX IF NOT EXISTS idx_mnp_matricula_cartera_canal_rut
  ON public.mnp_matricula_cartera_canal (anio_periodo, semestre_periodo, rut_norm);

CREATE INDEX IF NOT EXISTS idx_mnp_matricula_cartera_canal_canal
  ON public.mnp_matricula_cartera_canal (anio_periodo, semestre_periodo, canal);

COMMENT ON TABLE public.mnp_matricula_cartera_canal IS
  'Rematriculados de la cartera oficial clasificados por canal MOL (usuario caja) o Backoffice. Refresh diario desde uniacc-api.';

ALTER TABLE public.mnp_matricula_cartera_canal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_matricula_cartera_canal_select ON public.mnp_matricula_cartera_canal;
CREATE POLICY mnp_matricula_cartera_canal_select
  ON public.mnp_matricula_cartera_canal FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.mnp_matricula_cartera_canal TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.mnp_matricula_cartera_canal TO service_role;

CREATE OR REPLACE FUNCTION public.kpi_matricula_cartera_canal(
  p_anio integer,
  p_semestre integer
)
RETURNS TABLE (
  total integer,
  por_mol integer,
  por_bo integer,
  synced_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::integer AS total,
    count(*) FILTER (WHERE canal = 'MOL')::integer AS por_mol,
    count(*) FILTER (WHERE canal = 'BO')::integer AS por_bo,
    max(c.synced_at) AS synced_at
  FROM public.mnp_matricula_cartera_canal c
  WHERE c.anio_periodo = p_anio
    AND c.semestre_periodo = p_semestre;
$$;

COMMENT ON FUNCTION public.kpi_matricula_cartera_canal(integer, integer) IS
  'Totales Total / MOL / BO y última sync del batch de canal de matrícula.';

GRANT EXECUTE ON FUNCTION public.kpi_matricula_cartera_canal(integer, integer)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consultar_matricula_cartera_canal_bo(
  p_rut text,
  p_anio integer,
  p_semestre integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := upper(regexp_replace(coalesce(p_rut, ''), '[^0-9K]', '', 'g'));
  v_row public.mnp_matricula_cartera_canal%ROWTYPE;
BEGIN
  IF v_norm IS NULL OR v_norm = '' OR p_anio IS NULL OR p_semestre IS NULL THEN
    RETURN jsonb_build_object('bloqueado', false);
  END IF;

  SELECT *
  INTO v_row
  FROM public.mnp_matricula_cartera_canal c
  WHERE c.anio_periodo = p_anio
    AND c.semestre_periodo = p_semestre
    AND c.rut_norm = v_norm
    AND c.canal = 'BO'
  ORDER BY c.synced_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('bloqueado', false);
  END IF;

  RETURN jsonb_build_object(
    'bloqueado', true,
    'canal', v_row.canal,
    'codcli', v_row.codcli,
    'fec_mat', v_row.fec_mat
  );
END;
$$;

COMMENT ON FUNCTION public.consultar_matricula_cartera_canal_bo(text, integer, integer) IS
  'true si el RUT está matriculado por Backoffice en el periodo (gate login).';

GRANT EXECUTE ON FUNCTION public.consultar_matricula_cartera_canal_bo(text, integer, integer)
  TO anon, authenticated, service_role;
