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

function matriculaPorCobrar(matriculaPorPagar: number | null | undefined): boolean {
  // Si no se informa, se asume que hay matrícula por cobrar (compat).
  if (matriculaPorPagar == null) return true
  return matriculaPorPagar > 0
}

export function siguientePaso(input: {
  medioMatricula: MedioConcepto | null
  medioArancel: MedioConcepto | null
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  planListo: boolean
  /** Neto de arancel. Si ≤ 0, no se pide medio ni cobro de arancel. */
  arancelPorPagar?: number | null
  /** Neto de matrícula. Si ≤ 0, no se pide medio ni cobro de matrícula. */
  matriculaPorPagar?: number | null
}): PasoWebpay {
  const cobraArancel = arancelPorCobrar(input.arancelPorPagar)
  const cobraMatricula = matriculaPorCobrar(input.matriculaPorPagar)
  const matriculaResuelta = input.matriculaAutorizada || !cobraMatricula

  if (
    cobraMatricula &&
    input.medioMatricula === 'pagare' &&
    input.medioArancel === 'pagare'
  ) {
    return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
  }
  if (cobraMatricula && input.medioMatricula === 'webpay' && !input.matriculaAutorizada) {
    return { tipo: 'webpay', concepto: 'matricula' }
  }
  if (input.medioArancel == null) {
    if (!cobraArancel) {
      if (cobraMatricula && input.medioMatricula === 'pagare') {
        return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
      }
      // Matrícula cubierta o Webpay ya autorizada y arancel $0 → firma.
      if (matriculaResuelta) return { tipo: 'firma' }
      return { tipo: 'elegir-arancel' }
    }
    return { tipo: 'elegir-arancel' }
  }
  if (input.medioArancel === 'webpay' && !input.arancelAutorizado) {
    return { tipo: 'webpay', concepto: 'arancel' }
  }
  if (
    (cobraMatricula && input.medioMatricula === 'pagare') ||
    input.medioArancel === 'pagare'
  ) {
    if (!input.planListo) {
      return {
        tipo: 'plan-pagare',
        concepto:
          cobraMatricula && input.medioMatricula === 'pagare' ? 'matricula' : 'arancel',
      }
    }
  }
  return { tipo: 'firma' }
}
