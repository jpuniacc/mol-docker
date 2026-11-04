import { supabase } from '@/services/supabaseClient'
import { rutNorm } from '@/utils/rutNorm'

export type KpiMatriculaCarteraCanal = {
  total: number
  por_mol: number
  por_bo: number
  synced_at: string | null
}

export async function fetchKpiMatriculaCarteraCanal(
  anio: number,
  semestre: number,
): Promise<{ data: KpiMatriculaCarteraCanal | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kpi_matricula_cartera_canal', {
    p_anio: anio,
    p_semestre: semestre,
  })
  if (error) return { data: null, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    return {
      data: { total: 0, por_mol: 0, por_bo: 0, synced_at: null },
      error: null,
    }
  }
  const r = row as Record<string, unknown>
  return {
    data: {
      total: Number(r.total ?? 0) || 0,
      por_mol: Number(r.por_mol ?? 0) || 0,
      por_bo: Number(r.por_bo ?? 0) || 0,
      synced_at: r.synced_at == null ? null : String(r.synced_at),
    },
    error: null,
  }
}

export async function consultarMatriculaCarteraCanalBo(
  rut: string | null | undefined,
  anio: number,
  semestre: number,
): Promise<{ bloqueado: boolean; error: string | null }> {
  const norm = rutNorm(rut)
  if (!norm) return { bloqueado: false, error: null }
  const { data, error } = await supabase.rpc('consultar_matricula_cartera_canal_bo', {
    p_rut: norm,
    p_anio: anio,
    p_semestre: semestre,
  })
  if (error) return { bloqueado: false, error: error.message }
  const row = data as { bloqueado?: boolean } | null
  return { bloqueado: row?.bloqueado === true, error: null }
}
