import { supabase } from '@/services/supabaseClient'
import {
  parseFilaReporteBecas,
  parseKpiReporteBecas,
  type FilaReporteBecasRematricula,
  type KpiReporteBecasRematricula,
} from '@/utils/reporteBecasRematricula'

export async function fetchKpiReporteBecasRematricula(
  anio: number,
  semestre: number,
  carrera: string | null = null,
): Promise<{ data: KpiReporteBecasRematricula | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_reporte_becas_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_carrera: carrera,
  })
  if (error) return { data: null, error: error.message }
  return { data: parseKpiReporteBecas(data), error: null }
}

export async function listarReporteBecasRematricula(
  anio: number,
  semestre: number,
  carrera: string | null = null,
  q: string | null = null,
): Promise<{ data: FilaReporteBecasRematricula[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_reporte_becas_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_carrera: carrera,
    p_q: q,
  })
  if (error) return { data: [], error: error.message }
  const filas: FilaReporteBecasRematricula[] = []
  for (const row of Array.isArray(data) ? data : []) {
    const parsed = parseFilaReporteBecas(row)
    if (parsed) filas.push(parsed)
  }
  return { data: filas, error: null }
}
