import {
  CONVENIO_OFERTAS,
  type ConvenioEstado,
  type ConvenioOfertaCodigo,
} from '@/constants/convenioInstitucional'
import type {
  TpMnpConvenioDescuentoRow,
  TpMnpConvenioPeriodoRow,
  TpMnpConvenioRow,
} from '@/types/supabase'
import { supabase } from '@/services/supabaseClient'

export type ConvenioInstitucionalCompleto = TpMnpConvenioRow & {
  descuentos: TpMnpConvenioDescuentoRow[]
  periodos: TpMnpConvenioPeriodoRow[]
}

export type ConvenioDescuentoInput = {
  oferta_codigo: ConvenioOfertaCodigo
  aplica: boolean
  porcentaje: number | null
}

export type ConvenioPeriodoInput = {
  anio_periodo: number
  semestre_periodo: number
  activo?: boolean
}

export type ConvenioUpsertInput = {
  id?: string
  codigo_beneficio: string | null
  institucion: string
  beneficiarios: string | null
  estado: ConvenioEstado
  obs_1: string | null
  obs_2: string | null
  concepto?: 'MATRICULA' | 'ARANCEL' | 'AMBOS'
  activo?: boolean
  descuentos: ConvenioDescuentoInput[]
  periodos: ConvenioPeriodoInput[]
}

function emptyDescuentos(): ConvenioDescuentoInput[] {
  return CONVENIO_OFERTAS.map((o) => ({
    oferta_codigo: o.codigo,
    aplica: false,
    porcentaje: null,
  }))
}

export function defaultDescuentos(): ConvenioDescuentoInput[] {
  return emptyDescuentos()
}

export async function fetchConveniosInstitucionales(): Promise<{
  data: ConvenioInstitucionalCompleto[]
  error: string | null
}> {
  const { data: convenios, error } = await supabase
    .from('tp_mnp_convenio')
    .select('*')
    .order('institucion', { ascending: true })

  if (error) return { data: [], error: error.message }

  const ids = (convenios ?? []).map((c) => c.id)
  if (ids.length === 0) return { data: [], error: null }

  const [descRes, perRes] = await Promise.all([
    supabase.from('tp_mnp_convenio_descuento').select('*').in('convenio_id', ids),
    supabase.from('tp_mnp_convenio_periodo').select('*').in('convenio_id', ids),
  ])

  if (descRes.error) return { data: [], error: descRes.error.message }
  if (perRes.error) return { data: [], error: perRes.error.message }

  const descuentos = (descRes.data ?? []) as TpMnpConvenioDescuentoRow[]
  const periodos = (perRes.data ?? []) as TpMnpConvenioPeriodoRow[]

  const rows: ConvenioInstitucionalCompleto[] = ((convenios ?? []) as TpMnpConvenioRow[]).map(
    (c) => ({
      ...c,
      descuentos: descuentos.filter((d) => d.convenio_id === c.id),
      periodos: periodos.filter((p) => p.convenio_id === c.id),
    }),
  )

  return { data: rows, error: null }
}

async function replaceDescuentos(convenioId: string, descuentos: ConvenioDescuentoInput[]) {
  const { error: delErr } = await supabase
    .from('tp_mnp_convenio_descuento')
    .delete()
    .eq('convenio_id', convenioId)
  if (delErr) return delErr.message

  const payload = descuentos.map((d) => ({
    convenio_id: convenioId,
    oferta_codigo: d.oferta_codigo,
    aplica: d.aplica,
    porcentaje: d.aplica ? d.porcentaje : null,
  }))

  if (payload.length === 0) return null

  const { error } = await supabase.from('tp_mnp_convenio_descuento').insert(payload)
  return error?.message ?? null
}

async function replacePeriodos(convenioId: string, periodos: ConvenioPeriodoInput[]) {
  const { error: delErr } = await supabase
    .from('tp_mnp_convenio_periodo')
    .delete()
    .eq('convenio_id', convenioId)
  if (delErr) return delErr.message

  if (periodos.length === 0) return null

  const payload = periodos.map((p) => ({
    convenio_id: convenioId,
    anio_periodo: p.anio_periodo,
    semestre_periodo: p.semestre_periodo,
    activo: p.activo ?? true,
  }))

  const { error } = await supabase.from('tp_mnp_convenio_periodo').insert(payload)
  return error?.message ?? null
}

export async function upsertConvenioInstitucional(
  input: ConvenioUpsertInput,
): Promise<{ data: ConvenioInstitucionalCompleto | null; error: string | null }> {
  const institucion = input.institucion.trim()
  if (!institucion) return { data: null, error: 'La institución es obligatoria' }

  const base = {
    codigo_beneficio: input.codigo_beneficio?.trim() || null,
    institucion,
    beneficiarios: input.beneficiarios?.trim() || null,
    estado: input.estado,
    obs_1: input.obs_1?.trim() || null,
    obs_2: input.obs_2?.trim() || null,
    concepto: input.concepto ?? 'ARANCEL',
    activo: input.activo ?? true,
    updated_at: new Date().toISOString(),
  }

  let convenioId = input.id

  if (convenioId) {
    const { error } = await supabase.from('tp_mnp_convenio').update(base).eq('id', convenioId)
    if (error) return { data: null, error: error.message }
  } else {
    // Upsert por institución (casefold): buscar existente
    const { data: existing } = await supabase
      .from('tp_mnp_convenio')
      .select('id')
      .ilike('institucion', institucion)
      .maybeSingle()

    if (existing?.id) {
      convenioId = existing.id
      const { error } = await supabase.from('tp_mnp_convenio').update(base).eq('id', convenioId)
      if (error) return { data: null, error: error.message }
    } else {
      const { data, error } = await supabase
        .from('tp_mnp_convenio')
        .insert(base)
        .select('*')
        .single()
      if (error) return { data: null, error: error.message }
      convenioId = (data as TpMnpConvenioRow).id
    }
  }

  if (!convenioId) return { data: null, error: 'No se pudo determinar el id del convenio' }

  const descErr = await replaceDescuentos(convenioId, input.descuentos)
  if (descErr) return { data: null, error: descErr }

  const perErr = await replacePeriodos(convenioId, input.periodos)
  if (perErr) return { data: null, error: perErr }

  const { data: all, error } = await fetchConveniosInstitucionales()
  if (error) return { data: null, error }
  const row = all.find((r) => r.id === convenioId) ?? null
  return { data: row, error: null }
}

export async function softDeleteConvenioInstitucional(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tp_mnp_convenio')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function importConveniosInstitucionales(
  rows: ConvenioUpsertInput[],
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = []
  let ok = 0
  for (const row of rows) {
    const { error } = await upsertConvenioInstitucional(row)
    if (error) errors.push(`${row.institucion}: ${error}`)
    else ok += 1
  }
  return { ok, errors }
}
