import { supabase } from '@/services/supabaseClient'
import type { PlanPagosMvRow } from '@/types/supabase'

/** Tope práctico de filas a traer (paginado). PostgREST suele limitar a 1000 por request. */
const DEFAULT_LIMIT = 20000
/** Alineado con PGRST_DB_MAX_ROWS típico (1000) para paginar sin truncar. */
const PAGE_SIZE = 1000

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
  const maxRows = options?.limit ?? DEFAULT_LIMIT
  const out: PlanPagosMvRow[] = []

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1)
    let q = supabase
      .from('v_mnp_mv_plan_pagos')
      .select('*')
      // Orden estable: evita saltos/duplicados al paginar cuando synced_at es idéntico.
      .order('synced_at', { ascending: false })
      .order('codcli', { ascending: true })
      .order('rut', { ascending: true })
      .range(from, to)

    if (options?.anioMatricula != null) {
      q = q.eq('anio_matricula', options.anioMatricula)
    }
    if (options?.periodoMatricula != null) {
      q = q.eq('periodo_matricula', options.periodoMatricula)
    }

    const { data, error } = await q
    if (error) {
      return { data: out, error: error.message }
    }

    const page = (data ?? []) as PlanPagosMvRow[]
    out.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return { data: out, error: null }
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
