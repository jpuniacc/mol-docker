import { supabase } from '@/services/supabaseClient'
import type { MnpEstadoCaeAlumnoRow } from '@/types/supabase'

const DEFAULT_LIMIT = 50000

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

/** Monto CAE aprobado del alumno, para numerar el pagaré CAE del plan. */
export async function fetchMontoCaeAprobadoAlumno(options: {
  codcli: string
  anio: number
  semestre: number
}): Promise<number> {
  const { data, error } = await supabase
    .from('mnp_estado_cae_alumnos')
    .select('monto_cae_aprobado, monto_apr, monto')
    .eq('codcli', options.codcli)
    .eq('anio_matricula', options.anio)
    .eq('periodo_matricula', options.semestre)
    .eq('cod_beneficio_cargado', 4)
    .limit(1)

  if (error || !data?.[0]) return 0
  const row = data[0]
  const monto = Number(row.monto_cae_aprobado ?? row.monto_apr ?? row.monto ?? 0)
  return Number.isFinite(monto) && monto > 0 ? Math.round(monto) : 0
}

export async function fetchMnpEstadoCaeAlumnos(options: {
  anio: number
  semestre: number
  limit?: number
}): Promise<{ data: MnpEstadoCaeAlumnoRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('mnp_estado_cae_alumnos')
    .select('*')
    .eq('anio_matricula', options.anio)
    .eq('periodo_matricula', options.semestre)
    .eq('cod_beneficio_cargado', 4)
    .order('codcli', { ascending: true })
    .order('cod_beneficio_cargado', { ascending: true })
    .limit(options.limit ?? DEFAULT_LIMIT)

  return {
    data: (data ?? []) as MnpEstadoCaeAlumnoRow[],
    error: error?.message ?? null,
  }
}
