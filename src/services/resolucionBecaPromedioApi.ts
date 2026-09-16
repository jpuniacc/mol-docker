import { supabase } from '@/services/supabaseClient'
import type { MnpResolucionBecaPromedioRow } from '@/types/supabase'
import type { ResolucionBecaItem } from '@/utils/resolucionBecaPromedio'

export async function guardarResolucionesBecaPromedio(input: {
  periodo: string
  codcli: string
  items: ResolucionBecaItem[]
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('guardar_resoluciones_beca_promedio', {
    p_periodo: input.periodo,
    p_codcli: input.codcli,
    p_items: input.items.map((r) => ({
      codigo_beneficio: r.codigoBeneficio,
      promedio_usado: r.promedioUsado,
      fuente: r.fuente,
      porc_base: r.porcBase,
      monto_base: r.montoBase,
      porc_final: r.porcFinal,
      monto_final: r.montoFinal,
      disminucion: r.disminucion,
      resultado: r.resultado,
    })),
  })
  return { error: error?.message ?? null }
}

export async function consultarResolucionesBecaPromedio(
  codcli: string,
  periodo: string,
): Promise<{ data: MnpResolucionBecaPromedioRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_resoluciones_beca_promedio', {
    p_codcli: codcli,
    p_periodo: periodo,
  })
  return {
    data: (data ?? []) as MnpResolucionBecaPromedioRow[],
    error: error?.message ?? null,
  }
}
