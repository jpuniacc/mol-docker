import { supabase } from '@/services/supabaseClient'
import type { DescuentoMatriculaAplicable } from '@/constants/descuentoMatriculaAnticipada'
import type { TpMnpDescuentoMatriculaAnticipadaRow } from '@/types/supabase'

const SELECT_COLS =
  'id, cod_beneficio, nombre, periodo, vigencia_desde, vigencia_hasta, aplicable_a, porcentaje_descuento, activo, created_at, updated_at'

export type DescuentoMatriculaAnticipadaInput = {
  cod_beneficio: number
  nombre: string
  periodo: string
  vigencia_desde: string
  vigencia_hasta: string
  aplicable_a: DescuentoMatriculaAplicable
  porcentaje_descuento: number
  activo: boolean
}

const FECHA_CALENDARIO_RE = /^(\d{4})-(\d{2})-(\d{2})/

/** Extrae YYYY-MM-DD sin conversión de zona horaria (columnas `date`). */
export function toInputFechaCalendario(iso: string | null | undefined): string {
  const match = FECHA_CALENDARIO_RE.exec(iso?.trim() ?? '')
  return match?.[0] ?? ''
}

/** Formatea una fecha calendario (inclusive) para pantalla. */
export function fmtFechaCalendario(iso: string | null | undefined): string {
  const match = FECHA_CALENDARIO_RE.exec(iso?.trim() ?? '')
  if (!match) return iso?.trim() || '—'
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return iso?.trim() || '—'
  }
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)))
  } catch {
    return `${day.toString().padStart(2, '0')}-${m}-${y}`
  }
}

export function fmtPorcentaje(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n))}%`
}

export function fmtFecha(iso: string | null | undefined): string {
  return fmtFechaCalendario(iso)
}

export function validarPeriodo(periodo: string): boolean {
  return /^\d{4}-[12]$/.test(periodo.trim())
}

export function validarVigencia(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return 'Indique vigencia desde y hasta.'
  const desdeCal = toInputFechaCalendario(desde)
  const hastaCal = toInputFechaCalendario(hasta)
  if (!desdeCal || !hastaCal) return 'Fechas de vigencia inválidas.'
  if (hastaCal < desdeCal) {
    return 'La vigencia hasta debe ser posterior o igual a vigencia desde (ambas inclusive).'
  }
  return null
}

export async function fetchDescuentosMatriculaAnticipada(): Promise<{
  data: TpMnpDescuentoMatriculaAnticipadaRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_mnp_descuento_matricula_anticipada')
    .select(SELECT_COLS)
    .order('periodo', { ascending: false })
    .order('aplicable_a', { ascending: true })
    .order('nombre', { ascending: true })

  return {
    data: (data ?? []) as TpMnpDescuentoMatriculaAnticipadaRow[],
    error: error?.message ?? null,
  }
}

export async function insertDescuentoMatriculaAnticipada(
  payload: DescuentoMatriculaAnticipadaInput,
): Promise<{ data: TpMnpDescuentoMatriculaAnticipadaRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tp_mnp_descuento_matricula_anticipada')
    .insert({
      cod_beneficio: payload.cod_beneficio,
      nombre: payload.nombre.trim(),
      periodo: payload.periodo.trim(),
      vigencia_desde: payload.vigencia_desde,
      vigencia_hasta: payload.vigencia_hasta,
      aplicable_a: payload.aplicable_a,
      porcentaje_descuento: payload.porcentaje_descuento,
      activo: payload.activo,
    })
    .select(SELECT_COLS)
    .maybeSingle()

  return {
    data: (data as TpMnpDescuentoMatriculaAnticipadaRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function updateDescuentoMatriculaAnticipada(
  id: number,
  payload: DescuentoMatriculaAnticipadaInput,
): Promise<{ data: TpMnpDescuentoMatriculaAnticipadaRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tp_mnp_descuento_matricula_anticipada')
    .update({
      cod_beneficio: payload.cod_beneficio,
      nombre: payload.nombre.trim(),
      periodo: payload.periodo.trim(),
      vigencia_desde: payload.vigencia_desde,
      vigencia_hasta: payload.vigencia_hasta,
      aplicable_a: payload.aplicable_a,
      porcentaje_descuento: payload.porcentaje_descuento,
      activo: payload.activo,
    })
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  return {
    data: (data as TpMnpDescuentoMatriculaAnticipadaRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function deleteDescuentoMatriculaAnticipada(
  id: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tp_mnp_descuento_matricula_anticipada')
    .delete()
    .eq('id', id)

  return { error: error?.message ?? null }
}
