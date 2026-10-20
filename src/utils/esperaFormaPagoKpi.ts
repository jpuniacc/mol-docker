export type FiltroEsperaFormaPago = 'todos' | 'cae' | 'ministerial' | 'ambos' | 'resto'
export type BucketEsperaFormaPago = 'cae' | 'ministerial' | 'ambos' | 'resto'

export function bucketEsperaFormaPago(
  esperaCae: boolean | null | undefined,
  esperaMinisterial: boolean | null | undefined,
): BucketEsperaFormaPago {
  const cae = esperaCae === true
  const min = esperaMinisterial === true
  if (cae && min) return 'ambos'
  if (cae) return 'cae'
  if (min) return 'ministerial'
  return 'resto'
}

export function coincideFiltroEspera(
  bucket: BucketEsperaFormaPago,
  filtro: FiltroEsperaFormaPago,
): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'cae') return bucket === 'cae' || bucket === 'ambos'
  if (filtro === 'ministerial') return bucket === 'ministerial' || bucket === 'ambos'
  if (filtro === 'ambos') return bucket === 'ambos'
  return bucket === 'resto'
}

export function etiquetaFiltroEsperaFormaPago(filtro: FiltroEsperaFormaPago): string {
  const map: Record<FiltroEsperaFormaPago, string> = {
    todos: 'Todos',
    cae: 'En espera CAE',
    ministerial: 'En espera Ministerial',
    ambos: 'Solo ambos',
    resto: 'Resto (pueden avanzar)',
  }
  return map[filtro]
}

export function etiquetaBucketEsperaFormaPago(bucket: BucketEsperaFormaPago): string {
  const map: Record<BucketEsperaFormaPago, string> = {
    cae: 'En espera CAE',
    ministerial: 'En espera Ministerial',
    ambos: 'En espera ambos',
    resto: 'Resto (pueden avanzar)',
  }
  return map[bucket]
}
