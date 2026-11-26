-- Smoke: refresh_actividad existe y progreso usa la tabla preagregada.
DO $$
DECLARE
  definicion text := pg_get_functiondef('public.refresh_mnp_progreso_rematricula(integer,integer)'::regprocedure);
  def_act text := pg_get_functiondef('public.refresh_mnp_progreso_actividad_periodo(integer,integer)'::regprocedure);
BEGIN
  IF def_act IS NULL THEN
    RAISE EXCEPTION 'Falta refresh_mnp_progreso_actividad_periodo';
  END IF;
  IF position('mnp_progreso_actividad_periodo' in definicion) = 0 THEN
    RAISE EXCEPTION 'refresh_mnp_progreso_rematricula no referencia mnp_progreso_actividad_periodo';
  END IF;
  IF position('logs_periodo AS MATERIALIZED' in definicion) > 0 THEN
    RAISE EXCEPTION 'refresh_mnp_progreso_rematricula aún escanea logs_periodo';
  END IF;
  IF position('webpay_matricula_ok' in definicion) > 0 THEN
    RAISE EXCEPTION 'refresh_mnp_progreso_rematricula aún tiene CTE webpay_matricula_ok';
  END IF;
END $$;
