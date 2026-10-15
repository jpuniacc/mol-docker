import { supabase } from '@/services/supabaseClient'
import type { TpMolProximamenteRow } from '@/types/supabase'

const SELECT_COLS = 'id, activo, mensaje, actualizado_en'

export async function fetchProximamente(): Promise<{
  data: TpMolProximamenteRow | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_mol_proximamente')
    .select(SELECT_COLS)
    .eq('id', 1)
    .maybeSingle()

  return {
    data: (data as TpMolProximamenteRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function updateProximamente(payload: {
  activo: boolean
  mensaje: string
}): Promise<{ data: TpMolProximamenteRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tp_mol_proximamente')
    .update({
      activo: payload.activo,
      mensaje: payload.mensaje.trim(),
    })
    .eq('id', 1)
    .select(SELECT_COLS)
    .maybeSingle()

  return {
    data: (data as TpMolProximamenteRow | null) ?? null,
    error: error?.message ?? null,
  }
}
