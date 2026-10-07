export type MedioConcepto = 'webpay' | 'pagare'
export type PasoWebpay =
  | { tipo: 'flujo-pagare' }
  | { tipo: 'webpay'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'plan-pagare'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'elegir-arancel' }
  | { tipo: 'firma' }

export function siguientePaso(input: {
  medioMatricula: MedioConcepto
  medioArancel: MedioConcepto | null
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  planListo: boolean
}): PasoWebpay {
  if (input.medioMatricula === 'pagare' && input.medioArancel === 'pagare') {
    return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
  }
  if (input.medioMatricula === 'webpay' && !input.matriculaAutorizada) {
    return { tipo: 'webpay', concepto: 'matricula' }
  }
  if (input.medioArancel == null) {
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
