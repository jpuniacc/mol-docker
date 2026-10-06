-- Aviso al consejero, a mol y al alumno cuando la ficha queda matriculada.

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_tipo_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_tipo_check
  CHECK (tipo IN (
    'TYC_RECHAZO',
    'CONVENIO_CERTIFICADO',
    'CONVENIO_CERTIFICADO_ALUMNO',
    'CONVENIO_CERTIFICADO_APROBADO',
    'CONVENIO_CERTIFICADO_APROBADO_ALUMNO',
    'CONVENIO_CERTIFICADO_RECHAZADO',
    'CONVENIO_CERTIFICADO_RECHAZADO_ALUMNO',
    'CONVENIO_CERTIFICADO_ELIMINADO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA',
    'MATRICULADO',
    'MATRICULADO_ALUMNO'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_matriculado
  ON public.mnp_aviso_consejero (tipo, periodo, codcli)
  WHERE tipo IN ('MATRICULADO', 'MATRICULADO_ALUMNO');

CREATE OR REPLACE FUNCTION public.encolar_mnp_aviso_matriculado(
  p_periodo text,
  p_codcli text,
  p_rut_alumno text DEFAULT NULL,
  p_nombre_alumno text DEFAULT NULL,
  p_carrera text DEFAULT NULL,
  p_jornada text DEFAULT NULL,
  p_ref_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mnp_aviso_consejero (
    tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    ref_id, payload, estado, es_mock
  ) VALUES (
    'MATRICULADO', trim(p_periodo), trim(p_codcli),
    nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
    nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
    nullif(trim(p_ref_id), ''), '{}'::jsonb, 'pendiente', false
  )
  ON CONFLICT (tipo, periodo, codcli)
      WHERE tipo IN ('MATRICULADO', 'MATRICULADO_ALUMNO')
  DO NOTHING;

  INSERT INTO public.mnp_aviso_consejero (
    tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    ref_id, payload, estado, es_mock
  ) VALUES (
    'MATRICULADO_ALUMNO', trim(p_periodo), trim(p_codcli),
    nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
    nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
    nullif(trim(p_ref_id), ''), '{}'::jsonb, 'pendiente', false
  )
  ON CONFLICT (tipo, periodo, codcli)
      WHERE tipo IN ('MATRICULADO', 'MATRICULADO_ALUMNO')
  DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encolar_mnp_aviso_matriculado TO service_role;
