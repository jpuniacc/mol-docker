-- Backfill: alumnos en espera CAE/Ministerial del periodo activo sin fila de reserva.
-- Idempotente: reservar_descuento_matricula hace ON CONFLICT DO NOTHING.

DO $$
DECLARE
  v_anio integer;
  v_sem integer;
  r record;
  v_ok integer := 0;
  v_fail integer := 0;
  v_res jsonb;
BEGIN
  SELECT p.anio_periodo, p.semestre_periodo
  INTO v_anio, v_sem
  FROM public.tp_periodo_activo p
  WHERE p.estado IS TRUE
  LIMIT 1;

  IF v_anio IS NULL OR v_sem IS NULL THEN
    RAISE NOTICE 'backfill reserva: sin periodo activo, se omite';
    RETURN;
  END IF;

  FOR r IN
    SELECT
      p.codcli,
      p.rut,
      CASE
        WHEN coalesce(p.espera_ministerial, false)
             AND NOT coalesce(p.espera_cae, false) THEN 'ESTATAL'
        ELSE 'CAE'
      END AS motivo
    FROM public.mnp_progreso_rematricula p
    WHERE p.anio_periodo = v_anio
      AND p.semestre_periodo = v_sem
      AND p.etapa_actual = 'forma_pago'
      AND (coalesce(p.espera_cae, false) OR coalesce(p.espera_ministerial, false))
      AND NOT EXISTS (
        SELECT 1
        FROM public.mnp_reserva_descuento_matricula x
        WHERE x.codcli = p.codcli
          AND x.anio_periodo = v_anio
          AND x.semestre_periodo = v_sem
      )
  LOOP
    BEGIN
      v_res := public.reservar_descuento_matricula(
        r.codcli,
        v_anio,
        v_sem,
        r.rut,
        r.motivo
      );
      IF coalesce((v_res ->> 'reservado')::boolean, false) THEN
        v_ok := v_ok + 1;
      ELSE
        v_fail := v_fail + 1;
        RAISE NOTICE 'backfill reserva: sin descuento vigente para %', r.codcli;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE NOTICE 'backfill reserva: error % → %', r.codcli, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'backfill reserva periodo %-%: ok=% fail=%', v_anio, v_sem, v_ok, v_fail;
END;
$$;
