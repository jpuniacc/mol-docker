export const CODIGO_APOYO_UNIACC = '1756'
export const TOPE_INTERNAS = 0.7

export type FlujoPrelacion =
  | 'ESTATAL'
  | 'MOL_DVU'
  | 'CONVENIO'
  | 'FORMA_PAGO'
  | 'NO_RENOVABLE'
  | 'NO_VIGENTE'
  | 'EN_REVISION'
  | null

export type ItemPrelacionInput = {
  codigo: string
  descripcion: string
  flujo: FlujoPrelacion
  monto: number
  disminucion?: number
  pierde?: boolean
}

export type ItemPrelacionResultado = {
  codigo: string
  descripcion: string
  flujo: FlujoPrelacion
  aplica: boolean
  motivo: string | null
  porc: number
  monto: number
}

export type PrelacionArancelResultado = {
  arancelBruto: number
  descuentoEstatal: number
  descuentoInterna: number
  descuentoConvenio: number
  recorteTope: number
  descuentoTotal: number
  arancelNeto: number
  items: ItemPrelacionResultado[]
}

function normCod(valor: string): string {
  return valor.trim().toUpperCase()
}

function esApoyo(codigo: string): boolean {
  return normCod(codigo) === CODIGO_APOYO_UNIACC
}

function esMaternidad(item: ItemPrelacionInput): boolean {
  return /MATERNIDAD/i.test(item.descripcion) || /MATERNIDAD/i.test(item.codigo)
}

function porcEfectivo(item: ItemPrelacionInput, arancelBruto: number): number {
  if (item.pierde || arancelBruto <= 0) return 0
  const monto = Number(item.monto)
  if (!Number.isFinite(monto) || monto <= 0) return 0
  const disminucion = item.disminucion ?? 0
  return (monto / arancelBruto) * (1 - disminucion)
}

function descuentoSobreSaldo(saldo: number, porc: number): number {
  if (saldo <= 0 || porc <= 0) return 0
  return Math.max(0, Math.min(saldo, Math.round(saldo * porc)))
}

function motivoFuera(flujo: FlujoPrelacion, pierde: boolean | undefined): string | null {
  if (pierde) return 'Pierde (Art. 13)'
  if (flujo === 'ESTATAL' || flujo === 'MOL_DVU' || flujo === 'CONVENIO') return null
  return 'Fuera de prelación'
}

export function aplicarPrelacionArancel(input: {
  arancelBruto: number
  items: ItemPrelacionInput[]
}): PrelacionArancelResultado {
  const bruto = Number(input.arancelBruto)
  const arancelBruto = Number.isFinite(bruto) && bruto > 0 ? bruto : 0

  const enriched = input.items.map((raw) => {
    const porc = porcEfectivo(raw, arancelBruto)
    const fuera = motivoFuera(raw.flujo, raw.pierde)
    return { raw, porc, fuera }
  })

  const items: ItemPrelacionResultado[] = enriched.map(({ raw, porc, fuera }) => ({
    codigo: raw.codigo,
    descripcion: raw.descripcion,
    flujo: raw.flujo,
    aplica: false,
    motivo: fuera,
    porc,
    monto: 0,
  }))

  if (arancelBruto <= 0) {
    return {
      arancelBruto,
      descuentoEstatal: 0,
      descuentoInterna: 0,
      descuentoConvenio: 0,
      recorteTope: 0,
      descuentoTotal: 0,
      arancelNeto: 0,
      items,
    }
  }

  let saldo = arancelBruto
  let descuentoEstatal = 0
  let descuentoInterna = 0
  let descuentoConvenio = 0
  let recorteTope = 0

  const aplicarEn = (index: number, capa: 'ESTATAL' | 'INTERNA' | 'CONVENIO'): number => {
    const desc = descuentoSobreSaldo(saldo, enriched[index].porc)
    saldo -= desc
    items[index] = {
      ...items[index],
      aplica: desc > 0 || enriched[index].porc > 0,
      motivo: null,
      monto: desc,
    }
    if (capa === 'ESTATAL') descuentoEstatal += desc
    if (capa === 'INTERNA') descuentoInterna += desc
    if (capa === 'CONVENIO') descuentoConvenio += desc
    return desc
  }

  enriched.forEach((row, i) => {
    if (row.raw.flujo === 'ESTATAL' && !row.fuera) aplicarEn(i, 'ESTATAL')
  })

  const internas = enriched
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.raw.flujo === 'MOL_DVU' && !row.fuera)

  const maternidad = internas.find((row) => esMaternidad(row.raw))
  const apoyo = internas.find((row) => esApoyo(row.raw.codigo))
  const candidatas = internas.filter((row) => !esApoyo(row.raw.codigo))

  const elegidas: number[] = []
  if (maternidad) {
    elegidas.push(maternidad.index)
  } else {
    let ganadora = candidatas[0]
    for (const c of candidatas) {
      if (!ganadora || c.porc > ganadora.porc) ganadora = c
    }
    if (ganadora) elegidas.push(ganadora.index)
    if (apoyo) elegidas.push(apoyo.index)
  }

  const elegidasSet = new Set(elegidas)
  for (const row of internas) {
    if (elegidasSet.has(row.index)) continue
    items[row.index] = {
      ...items[row.index],
      aplica: false,
      motivo: maternidad && !esMaternidad(row.raw) ? 'No acumula (maternidad)' : 'No acumula (Art. 9)',
      monto: 0,
    }
  }
  for (const index of elegidas) aplicarEn(index, 'INTERNA')

  const topeInternas = Math.round(arancelBruto * TOPE_INTERNAS)
  if (descuentoInterna > topeInternas) {
    recorteTope += descuentoInterna - topeInternas
    saldo += descuentoInterna - topeInternas
    descuentoInterna = topeInternas
    let restante = recorteTope
    for (const index of [...elegidas].reverse()) {
      if (restante <= 0) break
      const corte = Math.min(items[index].monto, restante)
      items[index] = { ...items[index], monto: items[index].monto - corte }
      restante -= corte
    }
  }

  enriched.forEach((row, i) => {
    if (row.raw.flujo === 'CONVENIO' && !row.fuera) aplicarEn(i, 'CONVENIO')
  })

  const descuentoTotal = descuentoEstatal + descuentoInterna + descuentoConvenio
  if (descuentoTotal > arancelBruto) {
    const extra = descuentoTotal - arancelBruto
    recorteTope += extra
    saldo += extra
    descuentoConvenio = Math.max(0, descuentoConvenio - extra)
  }

  return {
    arancelBruto,
    descuentoEstatal,
    descuentoInterna,
    descuentoConvenio,
    recorteTope,
    descuentoTotal: descuentoEstatal + descuentoInterna + descuentoConvenio,
    arancelNeto: Math.max(0, arancelBruto - (descuentoEstatal + descuentoInterna + descuentoConvenio)),
    items,
  }
}
