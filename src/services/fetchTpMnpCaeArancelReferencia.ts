import { supabase } from '@/services/supabaseClient'
import type { TpMnpCaeArancelReferenciaRow } from '@/types/supabase'

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

export function fmtCell(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

export async function fetchTpMnpCaeArancelReferencia(options?: {
  ano?: number
  limit?: number
}): Promise<{ data: TpMnpCaeArancelReferenciaRow[]; error: string | null }> {
  let q = supabase
    .from('tp_mnp_cae_arancel_referencia')
    .select('*')
    .order('cod_carrera', { ascending: true })
    .order('ano', { ascending: true })
    .order('periodo', { ascending: true })
    .limit(options?.limit ?? DEFAULT_LIMIT)

  if (options?.ano != null) {
    q = q.eq('ano', options.ano)
  }

  const { data, error } = await q
  return {
    data: (data ?? []) as TpMnpCaeArancelReferenciaRow[],
    error: error?.message ?? null,
  }
}
