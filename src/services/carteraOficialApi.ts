import { supabase } from '@/services/supabaseClient'
import type { EstadoCarteraOficial } from '@/constants/carteraOficial'
import { rutNorm } from '@/utils/rutNorm'

export type { EstadoCarteraOficial }

/**
 * Cruce contra `mnp_cartera_oficial` (Excel BASE PARA PRUEBA).
 * Si no hay cartera cargada, no bloquea (fail-open).
 */
export async function estadoCarteraOficial(
  rut: string | null | undefined,
): Promise<EstadoCarteraOficial> {
  const { count, error: countError } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm', { count: 'exact', head: true })

  if (countError || !count) {
    return { carteraCargada: false, enCartera: true, excluidoMol: false }
  }

  const norm = rutNorm(rut)
  if (!norm) {
    return { carteraCargada: true, enCartera: false, excluidoMol: false }
  }

  const { data, error } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm, excluido_mol')
    .eq('rut_norm', norm)
    .maybeSingle()

  if (error) {
    return { carteraCargada: false, enCartera: true, excluidoMol: false }
  }

  return {
    carteraCargada: true,
    enCartera: Boolean(data),
    excluidoMol: data?.excluido_mol === true,
  }
}
