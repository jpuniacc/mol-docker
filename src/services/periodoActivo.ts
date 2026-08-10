import { supabase } from '@/services/supabaseClient'
import type { TpPeriodoActivoRow } from '@/types/supabase'

export function periodoActivoLabel(anio: number, semestre: number): string {
  return `${anio}-${semestre}`
}

export function periodoActivoDesdeEnv(): { anio?: number; semestre?: number } {
  const a = import.meta.env.VITE_MNP_MV_ANIO_MATRICULA
  const p = import.meta.env.VITE_MNP_MV_PERIODO_MATRICULA
  const anio =
    a != null && String(a).trim() !== '' && Number.isFinite(Number(a)) ? Number(a) : undefined
  const semestre =
    p != null && String(p).trim() !== '' && Number.isFinite(Number(p)) ? Number(p) : undefined
  return { anio, semestre }
}

export async function fetchPeriodosActivos(): Promise<{
  data: TpPeriodoActivoRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_periodo_activo')
    .select('id, anio_periodo, semestre_periodo, created_at, estado')
    .order('anio_periodo', { ascending: false })
    .order('semestre_periodo', { ascending: false })

  return {
    data: (data ?? []) as TpPeriodoActivoRow[],
    error: error?.message ?? null,
  }
}

export async function fetchPeriodoActivoVigente(): Promise<{
  data: TpPeriodoActivoRow | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_periodo_activo')
    .select('id, anio_periodo, semestre_periodo, created_at, estado')
    .eq('estado', true)
    .maybeSingle()

  return {
    data: (data as TpPeriodoActivoRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function activarPeriodo(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('activar_tp_periodo_activo', { p_id: id })
  return { error: error?.message ?? null }
}
