import { supabase } from '@/services/supabaseClient'
import type { MnpMvBeneficioPeriodoRow } from '@/types/supabase'
import { validarCopiaPeriodo } from '@/utils/beneficioPeriodo'

export async function fetchBeneficioPeriodo(periodo: string): Promise<{
  data: MnpMvBeneficioPeriodoRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('mnp_mv_beneficio_periodo')
    .select('*')
    .eq('periodo', periodo)
    .order('codigo_beneficio', { ascending: true })

  return {
    data: (data ?? []) as MnpMvBeneficioPeriodoRow[],
    error: error?.message ?? null,
  }
}

export async function fetchPeriodosBeneficio(): Promise<{
  data: string[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('mnp_mv_beneficio_periodo')
    .select('periodo')
    .order('periodo', { ascending: false })

  const periodos = new Set<string>()
  for (const row of data ?? []) {
    const periodo = (row as { periodo: string }).periodo
    if (periodo) periodos.add(periodo)
  }

  return {
    data: [...periodos],
    error: error?.message ?? null,
  }
}

export async function actualizarAplicaBeneficioPeriodo(
  id: string,
  aplica: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('mnp_mv_beneficio_periodo')
    .update({ aplica })
    .eq('id', id)

  return { error: error?.message ?? null }
}

function filaCopia(row: MnpMvBeneficioPeriodoRow, periodo: string) {
  return {
    periodo,
    codigo_beneficio: row.codigo_beneficio,
    beneficio: row.beneficio,
    renovable: row.renovable,
    convenio: row.convenio,
    flujo: row.flujo,
    aplica: row.aplica,
    requiere_certificado: row.requiere_certificado,
    tipo_certificado: row.tipo_certificado,
  }
}

/** Copia todas las filas del origen al destino. El destino tiene que estar vacío. */
export async function copiarBeneficioPeriodo(
  origen: string,
  destino: string,
): Promise<{ error: string | null; copiadas: number }> {
  const origenTrim = origen.trim()
  const destinoTrim = destino.trim()

  const origenRes = await fetchBeneficioPeriodo(origenTrim)
  if (origenRes.error) return { error: origenRes.error, copiadas: 0 }
  if (origenRes.data.length === 0) {
    return { error: 'El periodo origen no tiene filas.', copiadas: 0 }
  }

  const destinoRes = await fetchBeneficioPeriodo(destinoTrim)
  if (destinoRes.error) return { error: destinoRes.error, copiadas: 0 }

  const validacion = validarCopiaPeriodo({
    origen: origenTrim,
    destino: destinoTrim,
    filasDestino: destinoRes.data.length,
  })
  if (validacion) return { error: validacion, copiadas: 0 }

  const { error } = await supabase
    .from('mnp_mv_beneficio_periodo')
    .insert(origenRes.data.map((row) => filaCopia(row, destinoTrim)))

  if (error) return { error: error.message, copiadas: 0 }
  return { error: null, copiadas: origenRes.data.length }
}
