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

/** El CAE de la rematrícula sale solo del consolidado de la cartera. */
export function requiereVerificacionCae(consolidado: string | null | undefined): boolean {
  return esperaDesdeConsolidado(consolidado).cae
}
