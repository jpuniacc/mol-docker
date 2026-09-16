import { supabase } from '@/services/supabaseClient'
import type { MnpMvBeneficioPeriodoRow } from '@/types/supabase'

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
