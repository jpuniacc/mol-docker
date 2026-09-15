import { supabase } from '@/services/supabaseClient'
import type {
  EtapaProgresoRematricula,
  KpiProgresoRematricula,
  MnpProgresoRematriculaRow,
  VLogMolSesionTimelineRow,
} from '@/types/supabase'

export async function refreshProgresoRematricula(
  anio: number,
  semestre: number,
): Promise<{ count: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('refresh_mnp_progreso_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
  })
  return { count: (data as number | null) ?? null, error: error?.message ?? null }
}

export async function fetchKpiProgresoRematricula(
  anio: number,
  semestre: number,
): Promise<{ data: KpiProgresoRematricula | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_mnp_progreso_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
  })
  const row = Array.isArray(data) ? data[0] : null
  return {
    data: (row as KpiProgresoRematricula | undefined) ?? null,
    error: error?.message ?? null,
  }
}

export async function listarProgresoRematricula(
  anio: number,
  semestre: number,
  filtros?: {
    etapa?: EtapaProgresoRematricula | null
    q?: string | null
  },
): Promise<{ data: MnpProgresoRematriculaRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_mnp_progreso_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_etapa: filtros?.etapa ?? null,
    p_q: filtros?.q ?? null,
  })
  return {
    data: (data ?? []) as MnpProgresoRematriculaRow[],
    error: error?.message ?? null,
  }
}

export async function listarTimelineMolAlumno(
  codcli: string,
  anio: number,
  semestre: number,
): Promise<{ data: VLogMolSesionTimelineRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_timeline_mol_alumno', {
    p_codcli: codcli,
    p_anio: anio,
    p_semestre: semestre,
  })
  return {
    data: (data ?? []) as VLogMolSesionTimelineRow[],
    error: error?.message ?? null,
  }
}
