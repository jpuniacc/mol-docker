import { supabase } from '@/services/supabaseClient'
import type { ReservaDescuentoMatriculaAplicar } from '@/utils/descuentoMatriculaMes'

export type ReservaDescuentoRpc = {
  reservado?: boolean
  descuento_id?: number
  nombre?: string
  monto?: number
}

export function reservaDesdeRpc(raw: ReservaDescuentoRpc | null): ReservaDescuentoMatriculaAplicar | null {
  if (!raw || raw.reservado !== true) return null
  const descuentoId = Number(raw.descuento_id)
  const monto = Number(raw.monto)
  const nombre = String(raw.nombre ?? '').trim()
  if (!Number.isFinite(descuentoId) || !Number.isFinite(monto) || monto <= 0 || !nombre) return null
  return { descuentoId, nombre, monto }
}

export async function consultarReservaDescuentoMatricula(input: {
  codcli: string
  anioPeriodo: number
  semestrePeriodo: number
}): Promise<{ data: ReservaDescuentoMatriculaAplicar | null; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_reserva_descuento_matricula', {
    p_codcli: input.codcli,
    p_anio_periodo: input.anioPeriodo,
    p_semestre_periodo: input.semestrePeriodo,
  })
  if (error) return { data: null, error: error.message }
  return { data: reservaDesdeRpc(data), error: null }
}

export async function reservarDescuentoMatricula(input: {
  codcli: string
  anioPeriodo: number
  semestrePeriodo: number
  rutAlumno: string | null
  motivo: 'CAE' | 'ESTATAL'
}): Promise<{ data: ReservaDescuentoMatriculaAplicar | null; error: string | null }> {
  const { data, error } = await supabase.rpc('reservar_descuento_matricula', {
    p_codcli: input.codcli,
    p_anio_periodo: input.anioPeriodo,
    p_semestre_periodo: input.semestrePeriodo,
    p_rut_alumno: input.rutAlumno,
    p_motivo: input.motivo,
  })
  if (error) return { data: null, error: error.message }
  return { data: reservaDesdeRpc(data), error: null }
}

export async function consultarResolucionBecaEstatal(input: {
  codcli: string
  anioPeriodo: number
  semestrePeriodo: number
}): Promise<{ disponible: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_resolucion_beca_estatal', {
    p_codcli: input.codcli,
    p_anio_periodo: input.anioPeriodo,
    p_semestre_periodo: input.semestrePeriodo,
  })
  if (error) return { disponible: false, error: error.message }
  return { disponible: data?.resolucion_disponible === true, error: null }
}
