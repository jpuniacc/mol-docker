import { supabase } from '@/services/supabaseClient'
import {
  parseKpiTiemposTramo,
  type FilaTiempoTramo,
} from '@/utils/reporteTiemposTramo'

export async function fetchKpiReporteTiemposTramo(
  anio: number,
  semestre: number,
  carrera: string | null = null,
): Promise<{ data: FilaTiempoTramo[]; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_reporte_tiempos_tramo_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_carrera: carrera,
  })
  if (error) return { data: [], error: error.message }
  return { data: parseKpiTiemposTramo(data), error: null }
}
