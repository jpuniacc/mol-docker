import type { VerificacionCaeResultado } from '@/constants/verificacionCae'
import { supabase } from '@/services/supabaseClient'

export type EjecutarVerificacionCaePayload = {
  codcli: string
  anioPeriodo: number
  semestrePeriodo: number
  sesionId?: string | null
  rutAlumno?: string | null
  nombreAlumno?: string | null
  periodoLabel?: string | null
  esMock?: boolean
  urlOrigen?: string | null
}

export type EjecutarVerificacionCaeResponse = {
  resultado: VerificacionCaeResultado
  verificacion_id?: string
  mensaje?: string
}

export async function ejecutarVerificacionCae(
  payload: EjecutarVerificacionCaePayload,
): Promise<{ data: EjecutarVerificacionCaeResponse | null; error: string | null }> {
  const { data, error } = await supabase.rpc('ejecutar_verificacion_cae_mol', {
    p_codcli: payload.codcli,
    p_anio_periodo: payload.anioPeriodo,
    p_semestre_periodo: payload.semestrePeriodo,
    p_sesion_id: payload.sesionId ?? null,
    p_rut_alumno: payload.rutAlumno ?? null,
    p_nombre_alumno: payload.nombreAlumno ?? null,
    p_periodo_label: payload.periodoLabel ?? null,
    p_url_origen: payload.urlOrigen ?? (typeof window !== 'undefined' ? window.location.href : null),
    p_es_mock: payload.esMock ?? false,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const raw = data as EjecutarVerificacionCaeResponse | null
  if (!raw || (raw.resultado !== 'continua' && raw.resultado !== 'pendiente_resolucion')) {
    return { data: null, error: 'Respuesta de verificación CAE inválida.' }
  }

  return { data: raw, error: null }
}
