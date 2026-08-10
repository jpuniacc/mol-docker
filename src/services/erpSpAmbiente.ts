import { supabase } from '@/services/supabaseClient'
import type { TpMnpErpSpAmbienteRow } from '@/types/supabase'

export type ErpSpAmbiente = 'prod' | 'test'

export async function fetchErpSpAmbientes(): Promise<{
  data: TpMnpErpSpAmbienteRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_mnp_erp_sp_ambiente')
    .select('id, ambiente, label, estado, created_at, updated_at')
    .order('ambiente', { ascending: true })

  return {
    data: (data ?? []) as TpMnpErpSpAmbienteRow[],
    error: error?.message ?? null,
  }
}

export async function fetchErpSpAmbienteActivo(): Promise<{
  data: TpMnpErpSpAmbienteRow | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_mnp_erp_sp_ambiente')
    .select('id, ambiente, label, estado, created_at, updated_at')
    .eq('estado', true)
    .maybeSingle()

  return {
    data: (data as TpMnpErpSpAmbienteRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function activarErpSpAmbiente(
  ambiente: ErpSpAmbiente,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('activar_tp_mnp_erp_sp_ambiente', {
    p_ambiente: ambiente,
  })
  return { error: error?.message ?? null }
}
