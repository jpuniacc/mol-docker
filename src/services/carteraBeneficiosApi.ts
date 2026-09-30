import { supabase } from '@/services/supabaseClient'
import type { MnpCarteraBeneficiosRow, MnpMvAlumnosBeneficiosRow } from '@/types/supabase'
import { codigosAsignadosUltimoPeriodo } from '@/utils/carteraBeneficiosUi'

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

/**
 * Códigos de MT_POSBEN en estado 4 (ASIGNADO) del último periodo del alumno.
 * El extract ya guarda el estado como texto.
 */
export async function consultarCodigosBeneficioAsignados(
  codcli: string | null | undefined,
): Promise<{ codigos: Set<string>; error: string | null }> {
  const codigo = codcli?.trim() ?? ''
  if (!codigo) return { codigos: new Set(), error: null }

  const { data, error } = await supabase
    .from('mnp_mv_alumnos_beneficios')
    .select('cod_beneficio, ano, periodo, estado')
    .eq('codcli', codigo)

  if (error) return { codigos: new Set(), error: error.message }

  const filas = (data ?? []) as Pick<
    MnpMvAlumnosBeneficiosRow,
    'cod_beneficio' | 'ano' | 'periodo' | 'estado'
  >[]
  return { codigos: codigosAsignadosUltimoPeriodo(filas), error: null }
}
