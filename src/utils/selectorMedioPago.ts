export type Medio = 'pagare' | 'webpay' | null

export function arancelHabilitado(input: {
  medioMatricula: Medio
  matriculaAutorizada: boolean
}): boolean {
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}

export function puedeContinuar(input: {
  medioMatricula: Medio
  medioArancel: Medio
  matriculaAutorizada: boolean
}): boolean {
  if (input.medioArancel !== 'pagare') return false
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}
