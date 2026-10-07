CREATE TABLE IF NOT EXISTS public.log_mol_intento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  tema text NOT NULL,
  accion text NOT NULL,
  resultado text NOT NULL,
  mensaje text,
  payload jsonb,
  rut_alumno text,
  codcli text,
  anio_periodo integer,
  semestre_periodo integer,
  periodo_label text,
  CONSTRAINT log_mol_intento_resultado_chk CHECK (resultado IN ('ok', 'error'))
);

ALTER TABLE public.log_mol_intento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_mol_intento_no_anon ON public.log_mol_intento;
CREATE POLICY log_mol_intento_no_anon ON public.log_mol_intento
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS log_mol_intento_no_auth ON public.log_mol_intento;
CREATE POLICY log_mol_intento_no_auth ON public.log_mol_intento
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT, INSERT ON public.log_mol_intento TO service_role;

CREATE OR REPLACE FUNCTION public.log_mol_intento_a_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.registrar_log_mol_evento(
      p_categoria => NEW.tema,
      p_accion => NEW.accion,
      p_origen_tabla => 'log_mol_intento',
      p_origen_id => NEW.id,
      p_payload => jsonb_build_object(
        'resultado', NEW.resultado,
        'mensaje', NEW.mensaje
      ) || coalesce(NEW.payload, '{}'::jsonb),
      p_rut_alumno => NEW.rut_alumno,
      p_codcli => NEW.codcli,
      p_anio_periodo => NEW.anio_periodo,
      p_semestre_periodo => NEW.semestre_periodo,
      p_periodo_label => NEW.periodo_label
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_mol_intento no copió a log_mol_evento: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_mol_intento_a_evento ON public.log_mol_intento;
CREATE TRIGGER trg_log_mol_intento_a_evento
  AFTER INSERT ON public.log_mol_intento
  FOR EACH ROW
  EXECUTE FUNCTION public.log_mol_intento_a_evento();
