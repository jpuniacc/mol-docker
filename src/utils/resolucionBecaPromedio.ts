export type ResultadoResolucionBeca =
  | 'MANTIENE'
  | 'BAJA'
  | 'PIERDE'
  | 'BLOQUEO_SIN_PROMEDIO'
  | 'NO_APLICA'

export type FuentePromedio = 'anio' | 'periodo'

export type TramoArt13 = {
  resultado: 'MANTIENE' | 'BAJA' | 'PIERDE'
  disminucion: number
}

export type ResolucionBecaPromedio = {
  resultado: ResultadoResolucionBeca
  porcFinal: number | null
  montoFinal: number | null
  disminucion: number
  promedioUsado: number | null
  fuente: FuentePromedio | null
}

function norm(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase().replace(/,/g, '.')
}

function esNumero(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

export function redondearPromedio(promedio: number): number {
  return Math.round(promedio * 10) / 10
}

export function exigeMedicionPromedio(renovable: string | null | undefined): boolean {
  const t = norm(renovable)
  if (!t) return false
  if (t.includes('SIN REQUISITO')) return false
  return t.includes('PROMEDIO') && t.includes('5.5')
}

export function elegirPromedio(input: {
  promAnio: number | null | undefined
  promUltimoPeriodo: number | null | undefined
  promediosCerrados: boolean
}): { promedio: number; fuente: FuentePromedio } | null {
  const anio = esNumero(input.promAnio) ? input.promAnio : null
  const periodo = esNumero(input.promUltimoPeriodo) ? input.promUltimoPeriodo : null
  if (input.promediosCerrados) {
    if (anio != null) return { promedio: anio, fuente: 'anio' }
    if (periodo != null) return { promedio: periodo, fuente: 'periodo' }
    return null
  }
  if (periodo != null) return { promedio: periodo, fuente: 'periodo' }
  if (anio != null) return { promedio: anio, fuente: 'anio' }
  return null
}

const DISMINUCION_POR_NOTA: Record<string, number> = {
  '5.4': 0.15,
  '5.3': 0.15,
  '5.2': 0.2,
  '5.1': 0.25,
  '5.0': 0.3,
  '4.9': 0.35,
  '4.8': 0.4,
  '4.7': 0.45,
  '4.6': 0.5,
  '4.5': 0.55,
  '4.4': 0.6,
  '4.3': 0.65,
  '4.2': 0.7,
  '4.1': 0.75,
  '4.0': 0.8,
}

export function disminuirArt13(promedio: number): TramoArt13 {
  const nota = redondearPromedio(promedio)
  if (nota >= 5.5) return { resultado: 'MANTIENE', disminucion: 0 }
  if (nota <= 3.9) return { resultado: 'PIERDE', disminucion: 1 }
  const key = nota.toFixed(1)
  const disminucion = DISMINUCION_POR_NOTA[key]
  if (disminucion == null) return { resultado: 'PIERDE', disminucion: 1 }
  return { resultado: 'BAJA', disminucion }
}

function aplicarFactor(base: number | null, disminucion: number, perder: boolean): number | null {
  if (perder) return base == null ? 0 : 0
  if (base == null) return null
  return base * (1 - disminucion)
}

export type CatalogoBecaPromedio = {
  codigo_beneficio: string
  flujo: string
  renovable?: string | null
}

export type BeneficioParaResolucion = {
  cod_beneficio: string | null
  descripcion?: string | null
  porc_apr: number | null
  monto: number | null
  monto_aprobado?: number | null
}

export type ResolucionBecaItem = ResolucionBecaPromedio & {
  codigoBeneficio: string
  descripcion: string
  porcBase: number | null
  montoBase: number | null
  exigePromedio: boolean
}

function normalizarCodigo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}

function montoBaseDe(b: BeneficioParaResolucion): number | null {
  const aprobado = b.monto_aprobado
  if (typeof aprobado === 'number' && Number.isFinite(aprobado)) return aprobado
  if (typeof b.monto === 'number' && Number.isFinite(b.monto)) return b.monto
  return null
}

export function resolverBeneficiosDelPlan(input: {
  beneficios: BeneficioParaResolucion[]
  catalogo: CatalogoBecaPromedio[]
  promAnio: number | null | undefined
  promUltimoPeriodo: number | null | undefined
  promediosCerrados: boolean
}): ResolucionBecaItem[] {
  const porCodigo = new Map<string, CatalogoBecaPromedio>()
  for (const fila of input.catalogo) {
    const cod = normalizarCodigo(fila.codigo_beneficio)
    if (cod) porCodigo.set(cod, fila)
  }
  const elegido = elegirPromedio({
    promAnio: input.promAnio,
    promUltimoPeriodo: input.promUltimoPeriodo,
    promediosCerrados: input.promediosCerrados,
  })

  return input.beneficios.map((b) => {
    const codigo = (b.cod_beneficio ?? '').trim()
    const cat = porCodigo.get(normalizarCodigo(codigo))
    const exigePromedio =
      cat?.flujo === 'MOL_DVU' && exigeMedicionPromedio(cat.renovable)
    const porcBase = typeof b.porc_apr === 'number' && Number.isFinite(b.porc_apr) ? b.porc_apr : null
    const montoBase = montoBaseDe(b)
    const resolucion = resolverBecaPromedio({
      exigePromedio,
      porcApr: porcBase,
      monto: montoBase,
      promedio: elegido?.promedio ?? null,
      fuente: elegido?.fuente ?? null,
    })
    return {
      ...resolucion,
      codigoBeneficio: codigo,
      descripcion: (b.descripcion ?? '').trim() || codigo || 'Beneficio',
      porcBase,
      montoBase,
      exigePromedio,
    }
  })
}

export function resolverBecaPromedio(input: {
  exigePromedio: boolean
  porcApr: number | null
  monto: number | null
  promedio: number | null
  fuente: FuentePromedio | null
}): ResolucionBecaPromedio {
  if (!input.exigePromedio) {
    return {
      resultado: 'NO_APLICA',
      porcFinal: input.porcApr,
      montoFinal: input.monto,
      disminucion: 0,
      promedioUsado: input.promedio,
      fuente: input.fuente,
    }
  }
  if (input.promedio == null || !Number.isFinite(input.promedio)) {
    return {
      resultado: 'BLOQUEO_SIN_PROMEDIO',
      porcFinal: input.porcApr,
      montoFinal: input.monto,
      disminucion: 0,
      promedioUsado: null,
      fuente: null,
    }
  }
  const tramo = disminuirArt13(input.promedio)
  const perder = tramo.resultado === 'PIERDE'
  return {
    resultado: tramo.resultado,
    porcFinal: aplicarFactor(input.porcApr, tramo.disminucion, perder),
    montoFinal: aplicarFactor(input.monto, tramo.disminucion, perder),
    disminucion: tramo.disminucion,
    promedioUsado: redondearPromedio(input.promedio),
    fuente: input.fuente,
  }
}
