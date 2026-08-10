import { supabase } from '@/services/supabaseClient'
import type { MtArancelRow } from '@/types/supabase'

const DEFAULT_LIMIT = 10000

export function fmtMontoClp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export async function fetchMtArancel(options?: {
  ano?: number
  limit?: number
}): Promise<{ data: MtArancelRow[]; error: string | null }> {
  let q = supabase
    .from('mnp_mt_arancel')
    .select('*')
    .order('cod_carrera', { ascending: true })
    .order('ano', { ascending: true })
    .order('categoria_alumno', { ascending: true })
    .limit(options?.limit ?? DEFAULT_LIMIT)

  if (options?.ano != null) {
    q = q.eq('ano', options.ano)
  }

  const { data, error } = await q
  return {
    data: (data ?? []) as MtArancelRow[],
    error: error?.message ?? null,
  }
}
