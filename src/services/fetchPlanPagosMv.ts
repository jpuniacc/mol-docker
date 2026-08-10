import { supabase } from '@/services/supabaseClient'
import type { PlanPagosMvRow } from '@/types/supabase'

const DEFAULT_LIMIT = 8000

export function periodoMatriculaLabel(anio: number, periodo: number): string {
  return `${anio}-${periodo}`
}

export function fmtMontoClp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export async function fetchPlanPagosMv(options?: {
  anioMatricula?: number
  periodoMatricula?: number
  limit?: number
}): Promise<{ data: PlanPagosMvRow[]; error: string | null }> {
  let q = supabase
    .from('v_mnp_mv_plan_pagos')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(options?.limit ?? DEFAULT_LIMIT)

  if (options?.anioMatricula != null) {
    q = q.eq('anio_matricula', options.anioMatricula)
  }
  if (options?.periodoMatricula != null) {
    q = q.eq('periodo_matricula', options.periodoMatricula)
  }

  const { data, error } = await q
  return {
    data: (data ?? []) as PlanPagosMvRow[],
    error: error?.message ?? null,
  }
}

/** Una fila vigente por codcli (+ periodo de matrícula si se indica). */
export async function fetchPlanPagosMvByCodcli(options: {
  codcli: string
  anioMatricula?: number | null
  periodoMatricula?: number | null
}): Promise<{ data: PlanPagosMvRow | null; error: string | null }> {
  const codcli = options.codcli.trim()
  if (!codcli) return { data: null, error: 'codcli vacío' }

  let q = supabase
    .from('v_mnp_mv_plan_pagos')
    .select('*')
    .eq('codcli', codcli)
    .order('synced_at', { ascending: false })
    .limit(1)

  if (options.anioMatricula != null) {
    q = q.eq('anio_matricula', options.anioMatricula)
  }
  if (options.periodoMatricula != null) {
    q = q.eq('periodo_matricula', options.periodoMatricula)
  }

  const { data, error } = await q
  const row = (data?.[0] as PlanPagosMvRow | undefined) ?? null
  return { data: row, error: error?.message ?? null }
}
