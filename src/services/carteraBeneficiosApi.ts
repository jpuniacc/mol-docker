import { supabase } from '@/services/supabaseClient'
import type { MnpCarteraBeneficiosRow } from '@/types/supabase'

/** Periodo fijo de la cartera Excel (Rematrícula 2027-1). */
export const PERIODO_CARTERA_BENEFICIOS = '2027-01'

export async function consultarCarteraBeneficios(input: {
  periodo?: string
  codcliExcel?: string | null
  rutNorm?: string | null
}): Promise<{ data: MnpCarteraBeneficiosRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_cartera_beneficios', {
    p_periodo: input.periodo ?? PERIODO_CARTERA_BENEFICIOS,
    p_codcli_excel: input.codcliExcel?.trim() || null,
    p_rut_norm: input.rutNorm?.trim() || null,
  })
  const rows = (data ?? []) as MnpCarteraBeneficiosRow[]
  return {
    data: rows[0] ?? null,
    error: error?.message ?? null,
  }
}
