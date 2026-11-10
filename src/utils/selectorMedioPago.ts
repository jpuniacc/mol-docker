export type Medio = 'pagare' | 'webpay' | null

/** Matrícula neta a cobrar; ≤ 0 = cubierta (reintegro 100 %, etc.). */
export function matriculaRequiereMedio(matriculaPorPagar: number | null | undefined): boolean {
  return (matriculaPorPagar ?? 0) > 0
}

/** Arancel neto a cobrar; ≤ 0 = cubierto (beca 100 %, etc.). */
export function arancelRequiereMedio(arancelPorPagar: number | null | undefined): boolean {
  return (arancelPorPagar ?? 0) > 0
}

export function arancelHabilitado(input: {
  medioMatricula: Medio
  matriculaAutorizada: boolean
  /** Si se informa y es ≤ 0, la matrícula ya está cubierta y el arancel se enciende. */
  matriculaPorPagar?: number | null
}): boolean {
  if (input.matriculaAutorizada) return true
  if (input.matriculaPorPagar != null && !matriculaRequiereMedio(input.matriculaPorPagar)) return true
  return input.medioMatricula === 'pagare'
}

export function puedeContinuar(input: {
  medioMatricula: Medio
  medioArancel: Medio
  matriculaAutorizada: boolean
  /** Neto de arancel tras beneficios. Si ≤ 0 no se exige medio de arancel. */
  arancelPorPagar?: number | null
  /** Neto de matrícula. Si ≤ 0 no se exige medio de matrícula. */
  matriculaPorPagar?: number | null
}): boolean {
  if (arancelRequiereMedio(input.arancelPorPagar) && input.medioArancel !== 'pagare') {
    return false
  }
  if (input.matriculaAutorizada) return true
  if (input.matriculaPorPagar != null && !matriculaRequiereMedio(input.matriculaPorPagar)) return true
  return input.medioMatricula === 'pagare'
}
