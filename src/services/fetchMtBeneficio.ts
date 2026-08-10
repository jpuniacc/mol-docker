import { supabase } from '@/services/supabaseClient'
import type { MtBeneficioRow } from '@/types/supabase'

const DEFAULT_LIMIT = 10000

export function fmtMontoClp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export function fmtPorcentaje(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
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

export function fmtCell(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

export async function fetchMtBeneficio(options?: {
  limit?: number
}): Promise<{ data: MtBeneficioRow[]; error: string | null }> {
  const q = supabase
    .from('mnp_mt_beneficio')
    .select('*')
    .order('cod_beneficio', { ascending: true })
    .limit(options?.limit ?? DEFAULT_LIMIT)

  const { data, error } = await q
  return {
    data: (data ?? []) as MtBeneficioRow[],
    error: error?.message ?? null,
  }
}
