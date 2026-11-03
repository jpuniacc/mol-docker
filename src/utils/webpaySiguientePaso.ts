export type MedioConcepto = 'webpay' | 'pagare'
export type PasoWebpay =
  | { tipo: 'flujo-pagare' }
  | { tipo: 'webpay'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'plan-pagare'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'elegir-arancel' }
  | { tipo: 'firma' }

function arancelPorCobrar(arancelPorPagar: number | null | undefined): boolean {
  return (arancelPorPagar ?? 0) > 0
}

export function siguientePaso(input: {
  medioMatricula: MedioConcepto
  medioArancel: MedioConcepto | null
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  planListo: boolean
  /** Neto de arancel. Si ≤ 0, no se pide medio ni cobro de arancel. */
  arancelPorPagar?: number | null
}): PasoWebpay {
  const cobraArancel = arancelPorCobrar(input.arancelPorPagar)

  if (input.medioMatricula === 'pagare' && input.medioArancel === 'pagare') {
    return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
  }
  if (input.medioMatricula === 'webpay' && !input.matriculaAutorizada) {
    return { tipo: 'webpay', concepto: 'matricula' }
  }
  if (input.medioArancel == null) {
    if (!cobraArancel) {
      if (input.medioMatricula === 'pagare') {
        return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
      }
      // Matrícula Webpay ya autorizada y arancel $0 → firma.
      return { tipo: 'firma' }
    }
    return { tipo: 'elegir-arancel' }
  }
  if (input.medioArancel === 'webpay' && !input.arancelAutorizado) {
    return { tipo: 'webpay', concepto: 'arancel' }
  }
  if (input.medioMatricula === 'pagare' || input.medioArancel === 'pagare') {
    if (!input.planListo) {
      return {
        tipo: 'plan-pagare',
        concepto: input.medioMatricula === 'pagare' ? 'matricula' : 'arancel',
      }
    }
  }
  return { tipo: 'firma' }
}
