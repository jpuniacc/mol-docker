export type Medio = 'pagare' | 'webpay' | null

export function arancelHabilitado(input: {
  medioMatricula: Medio
  matriculaAutorizada: boolean
}): boolean {
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}

/** Arancel neto a cobrar; ≤ 0 = cubierto (beca 100 %, etc.). */
export function arancelRequiereMedio(arancelPorPagar: number | null | undefined): boolean {
  return (arancelPorPagar ?? 0) > 0
}

export function puedeContinuar(input: {
  medioMatricula: Medio
  medioArancel: Medio
  matriculaAutorizada: boolean
  /** Neto de arancel tras beneficios. Si ≤ 0 no se exige medio de arancel. */
  arancelPorPagar?: number | null
}): boolean {
  if (arancelRequiereMedio(input.arancelPorPagar) && input.medioArancel !== 'pagare') {
    return false
  }
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}
