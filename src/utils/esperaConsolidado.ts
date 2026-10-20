import { tieneCae } from '@/constants/verificacionCae'
import type { PlanPagosMvRow } from '@/types/supabase'
import { flagsConsolidado } from '@/utils/carteraBeneficiosUi'

export type EsperaConsolidado = {
  cae: boolean
  ministerial: boolean
  textoMinisterial: string | null
}

/** La espera sale del consolidado. BECA 1 y BECA 2 no participan. */
export function esperaDesdeConsolidado(
  consolidado: string | null | undefined,
): EsperaConsolidado {
  const flags = flagsConsolidado(consolidado ?? null)
  const texto = (consolidado ?? '').trim()
  return {
    cae: flags.cae,
    ministerial: flags.ministerial,
    textoMinisterial: flags.ministerial && texto ? texto : null,
  }
}

/** CAE del consolidado o del plan (`alumno_cae` en Si o Sí). */
export function requiereVerificacionCae(
  consolidado: string | null | undefined,
  plan: Pick<PlanPagosMvRow, 'alumno_cae'> | null | undefined,
): boolean {
  if (esperaDesdeConsolidado(consolidado).cae) return true
  return tieneCae(plan as PlanPagosMvRow | null | undefined)
}
