import { supabase } from '@/services/supabaseClient'
import {
  parseFilaReportePagos,
  parseKpiReportePagos,
  type FilaReportePagosRematricula,
  type KpiReportePagosRematricula,
} from '@/utils/reportePagosRematricula'

/** Solo matriculados MOL (v2). */
export async function fetchKpiReportePagosRematricula(
  anio: number,
  semestre: number,
  carrera: string | null = null,
): Promise<{ data: KpiReportePagosRematricula | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_reporte_pagos_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_carrera: carrera,
  })
  if (error) return { data: null, error: error.message }
  return { data: parseKpiReportePagos(data), error: null }
}

export async function listarReportePagosRematricula(
  anio: number,
  semestre: number,
  carrera: string | null = null,
  q: string | null = null,
): Promise<{ data: FilaReportePagosRematricula[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_reporte_pagos_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_carrera: carrera,
    p_q: q,
  })
  if (error) return { data: [], error: error.message }
  const filas: FilaReportePagosRematricula[] = []
  for (const row of Array.isArray(data) ? data : []) {
    const parsed = parseFilaReportePagos(row)
    if (parsed) filas.push(parsed)
  }
  return { data: filas, error: null }
}
