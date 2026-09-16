import { TERMINOS_CONDICIONES_MOL_CODIGO } from '@/constants/terminosCondicionesMol'
import { supabase } from '@/services/supabaseClient'
import type { UltimaRespuestaTyc } from '@/utils/tycAceptacion'

export type TyCAccionLog = 'acepta' | 'rechaza'

export type RegistrarLogTyCPayload = {
  accion: TyCAccionLog
  tycUpdatedAt: string
  tycTitulo: string
  rutAlumno: string | null
  codcli: string | null
  nombreAlumno: string | null
  anioPeriodo: number | null
  semestrePeriodo: number | null
  esMock: boolean
  sesionId?: string | null
  urlOrigen?: string | null
  periodoLabel?: string | null
}

export async function registrarLogTyCRespuesta(payload: RegistrarLogTyCPayload): Promise<string | null> {
  const { error } = await supabase.rpc('registrar_log_mol_tyc_respuesta', {
    p_accion: payload.accion,
    p_codigo_tyc: TERMINOS_CONDICIONES_MOL_CODIGO,
    p_tyc_updated_at: payload.tycUpdatedAt,
    p_tyc_titulo: payload.tycTitulo,
    p_rut_alumno: payload.rutAlumno,
    p_codcli: payload.codcli,
    p_nombre_alumno: payload.nombreAlumno,
    p_anio_periodo: payload.anioPeriodo,
    p_semestre_periodo: payload.semestrePeriodo,
    p_periodo_label: payload.periodoLabel ?? null,
    p_url_origen: payload.urlOrigen ?? (typeof window !== 'undefined' ? window.location.href : null),
    p_es_mock: payload.esMock,
    p_sesion_id: payload.sesionId ?? null,
  })

  if (error) return error.message
  return null
}

export async function consultarUltimaTycRespuestaAlumno(input: {
  codcli: string
  anioPeriodo: number
  semestrePeriodo: number
}): Promise<{ data: UltimaRespuestaTyc; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_ultima_tyc_respuesta_alumno', {
    p_codcli: input.codcli,
    p_anio_periodo: input.anioPeriodo,
    p_semestre_periodo: input.semestrePeriodo,
    p_codigo_tyc: TERMINOS_CONDICIONES_MOL_CODIGO,
  })
  if (error) return { data: null, error: error.message }
  const row = Array.isArray(data) ? data[0] : null
  if (!row || (row.accion !== 'acepta' && row.accion !== 'rechaza')) {
    return { data: null, error: null }
  }
  return {
    data: { accion: row.accion, tycUpdatedAt: row.tyc_updated_at },
    error: null,
  }
}
