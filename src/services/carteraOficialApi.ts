import { supabase } from '@/services/supabaseClient'
import { rutNorm } from '@/utils/rutNorm'

export type EstadoCarteraOficial = {
  /** false si la tabla está vacía o la consulta falló (fail-open). */
  carteraCargada: boolean
  enCartera: boolean
}

/**
 * Cruce contra `mnp_cartera_oficial` (Excel BASE PARA PRUEBA).
 * Si no hay cartera cargada, no bloquea.
 */
export async function estadoCarteraOficial(
  rut: string | null | undefined,
): Promise<EstadoCarteraOficial> {
  const { count, error: countError } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm', { count: 'exact', head: true })

  if (countError || !count) {
    return { carteraCargada: false, enCartera: true }
  }

  const norm = rutNorm(rut)
  if (!norm) {
    return { carteraCargada: true, enCartera: false }
  }

  const { data, error } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm')
    .eq('rut_norm', norm)
    .maybeSingle()

  if (error) {
    return { carteraCargada: false, enCartera: true }
  }

  return { carteraCargada: true, enCartera: Boolean(data) }
}
