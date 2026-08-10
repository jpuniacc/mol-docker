import { supabase } from '@/services/supabaseClient'

export type GuardarDiscapacidadEncuestaPayload = {
  contesta: boolean
  tipoDiscapacidad?: string | null
  afirmaciones?: string[]
  sesionId?: string | null
  rutAlumno?: string | null
  codcli?: string | null
  nombreAlumno?: string | null
  anioPeriodo?: number | null
  semestrePeriodo?: number | null
  periodoLabel?: string | null
  esMock?: boolean
  urlOrigen?: string | null
}

export async function guardarDiscapacidadEncuesta(
  payload: GuardarDiscapacidadEncuestaPayload,
): Promise<string | null> {
  const afirmaciones =
    payload.contesta && payload.afirmaciones && payload.afirmaciones.length > 0
      ? payload.afirmaciones
      : null

  const { error } = await supabase.rpc('guardar_mnp_discapacidad_encuesta', {
    p_contesta: payload.contesta,
    p_tipo_discapacidad: payload.contesta ? (payload.tipoDiscapacidad ?? null) : null,
    p_afirmaciones: afirmaciones,
    p_sesion_id: payload.sesionId ?? null,
    p_rut_alumno: payload.rutAlumno ?? null,
    p_codcli: payload.codcli ?? null,
    p_nombre_alumno: payload.nombreAlumno ?? null,
    p_anio_periodo: payload.anioPeriodo ?? null,
    p_semestre_periodo: payload.semestrePeriodo ?? null,
    p_periodo_label: payload.periodoLabel ?? null,
    p_url_origen: payload.urlOrigen ?? (typeof window !== 'undefined' ? window.location.href : null),
    p_es_mock: payload.esMock ?? false,
  })

  if (error) return error.message
  return null
}
