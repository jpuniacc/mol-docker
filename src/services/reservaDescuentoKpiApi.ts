import { supabase } from '@/services/supabaseClient'

export type KpiReservaDescuentoMatricula = {
  total: number
  por_cae: number
  por_beca: number
  por_cae_y_beca: number
}

export async function fetchKpiReservaDescuentoMatricula(
  anio: number,
  semestre: number,
): Promise<{ data: KpiReservaDescuentoMatricula | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_reserva_descuento_matricula', {
    p_anio: anio,
    p_semestre: semestre,
  })
  if (error) return { data: null, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    return {
      data: { total: 0, por_cae: 0, por_beca: 0, por_cae_y_beca: 0 },
      error: null,
    }
  }
  const r = row as Record<string, unknown>
  return {
    data: {
      total: Number(r.total ?? 0) || 0,
      por_cae: Number(r.por_cae ?? 0) || 0,
      por_beca: Number(r.por_beca ?? 0) || 0,
      por_cae_y_beca: Number(r.por_cae_y_beca ?? 0) || 0,
    },
    error: null,
  }
}
