import { CODIGO_APOYO_UNIACC, TOPE_INTERNAS } from '@/utils/prelacionArancel'
import {
  disminuirArt13,
  exigeMedicionPromedio,
  redondearPromedio,
  type FuentePromedio,
} from '@/utils/resolucionBecaPromedio'
import type { BeneficioExcelUiItem } from '@/utils/carteraBeneficiosUi'

export type ResultadoAjustePromedio = 'MANTIENE' | 'BAJA' | 'PIERDE' | 'NO_APLICA' | 'SIN_PROMEDIO'

export type CatalogoPromedioVista = {
  codigo_beneficio: string
  flujo: string | null
  renovable: string | null
}

export type FilaBeneficioPromedio = {
  slot: 1 | 2
  codigo: string | null
  flujo: string | null
  descripcion: string
  porcCatalogo: number | null
  porcAplica: number | null
  disminucion: number
  resultado: ResultadoAjustePromedio
  monto: number
  marcado: boolean
  /** true si esta fila absorbió el recorte al tope del 70 % de internas. */
  recortadoTope: boolean
}

function porcUnaDecimal(valor: number): number {
  return Math.round(valor * 10) / 10
}

function ajusteDePorcentaje(
  pct: number | null,
  exigePromedio: boolean,
  promedio: number | null,
): Pick<FilaBeneficioPromedio, 'porcAplica' | 'disminucion' | 'resultado'> {
  if (pct == null) {
    return { porcAplica: null, disminucion: 0, resultado: 'NO_APLICA' }
  }
  if (!exigePromedio) {
    return { porcAplica: pct, disminucion: 0, resultado: 'NO_APLICA' }
  }
  if (promedio == null || !Number.isFinite(promedio)) {
    return { porcAplica: pct, disminucion: 0, resultado: 'SIN_PROMEDIO' }
  }
  const tramo = disminuirArt13(promedio)
  if (tramo.resultado === 'PIERDE') {
    return { porcAplica: 0, disminucion: 1, resultado: 'PIERDE' }
  }
  if (tramo.resultado === 'MANTIENE') {
    return { porcAplica: pct, disminucion: 0, resultado: 'MANTIENE' }
  }
  return {
    porcAplica: porcUnaDecimal(pct * (1 - tramo.disminucion)),
    disminucion: tramo.disminucion,
    resultado: 'BAJA',
  }
}

function descuentoSobreSaldo(saldo: number, porc: number | null): number {
  if (saldo <= 0 || porc == null || porc <= 0) return 0
  return Math.max(0, Math.min(saldo, Math.round((saldo * porc) / 100)))
}

function esApoyo(fila: FilaBeneficioPromedio): boolean {
  return (fila.codigo ?? '').trim() === CODIGO_APOYO_UNIACC
}

/** Ganadora interna (mayor % ya ajustado), luego Apoyo 1756 sobre el saldo, luego convenios. */
function ordenCascade(filas: FilaBeneficioPromedio[]): FilaBeneficioPromedio[] {
  const vigentes = filas.filter(
    (f) => f.marcado && f.resultado !== 'PIERDE' && (f.porcAplica ?? 0) > 0,
  )
  const apoyo = vigentes.filter((f) => esApoyo(f))
  const resto = vigentes.filter((f) => !esApoyo(f))
  const internas = resto.filter((f) => (f.flujo ?? 'MOL_DVU') === 'MOL_DVU')
  const convenios = resto.filter((f) => f.flujo === 'CONVENIO')
  internas.sort((a, b) => (b.porcAplica ?? 0) - (a.porcAplica ?? 0))
  const ganadora = internas[0]
  return [...(ganadora ? [ganadora] : []), ...apoyo, ...convenios]
}

export function filasBeneficioConPromedio(input: {
  items: BeneficioExcelUiItem[]
  catalogo: CatalogoPromedioVista[]
  seleccionados: Record<number, boolean>
  arancelBruto: number
  promedio: number | null
}): FilaBeneficioPromedio[] {
  const porCodigo = new Map<string, CatalogoPromedioVista>()
  for (const fila of input.catalogo) {
    const cod = fila.codigo_beneficio.trim()
    if (cod) porCodigo.set(cod, fila)
  }

  const filas: FilaBeneficioPromedio[] = input.items.map((item) => {
    const cod = (item.cod_beneficio ?? '').trim() || null
    const cat = cod ? porCodigo.get(cod) : undefined
    const flujo = cat?.flujo ?? null
    const exige = flujo === 'MOL_DVU' && exigeMedicionPromedio(cat?.renovable)
    const ajuste = ajusteDePorcentaje(item.pct, exige, input.promedio)
    return {
      slot: item.slot,
      codigo: cod,
      flujo,
      descripcion: item.descripcion || 'Beneficio',
      porcCatalogo: item.pct,
      porcAplica: ajuste.porcAplica,
      disminucion: ajuste.disminucion,
      resultado: ajuste.resultado,
      monto: 0,
      marcado: input.seleccionados[item.slot] === true,
      recortadoTope: false,
    }
  })

  const orden = ordenCascade(filas)
  const internas = orden.filter((fila) => fila.flujo !== 'CONVENIO')
  const convenios = orden.filter((fila) => fila.flujo === 'CONVENIO')
  let saldo = Math.max(0, input.arancelBruto)
  for (const fila of internas) {
    const monto = descuentoSobreSaldo(saldo, fila.porcAplica)
    fila.monto = monto
    saldo -= monto
  }

  const tope = Math.round(Math.max(0, input.arancelBruto) * TOPE_INTERNAS)
  let exceso = internas.reduce((sum, fila) => sum + fila.monto, 0) - tope
  if (exceso > 0) {
    for (const fila of [...internas].reverse()) {
      if (exceso <= 0) break
      const corte = Math.min(fila.monto, exceso)
      fila.monto -= corte
      if (corte > 0) fila.recortadoTope = true
      exceso -= corte
      saldo += corte
    }
  }

  for (const fila of convenios) {
    const monto = descuentoSobreSaldo(saldo, fila.porcAplica)
    fila.monto = monto
    saldo -= monto
  }
  return filas
}

export function textoNotaPromedio(promedio: number | null): string {
  if (promedio == null || !Number.isFinite(promedio)) return '—'
  return redondearPromedio(promedio).toFixed(1).replace('.', ',')
}

/** Año de las notas: el anterior al periodo de rematrícula (2027-1 → 2026). */
export function anioNotasRematricula(anioPeriodo: number | null | undefined): number | null {
  if (anioPeriodo == null || !Number.isFinite(anioPeriodo)) return null
  return anioPeriodo - 1
}

export function textoFuentePromedio(
  fuente: FuentePromedio | null,
  anioNotas: number | null,
): string {
  const anio = anioNotas != null ? ` ${anioNotas}` : ''
  if (fuente === 'anio') return `Promedio del año${anio}`
  if (fuente === 'periodo') return `Promedio parcial del primer semestre${anio}`
  return 'Sin promedio registrado'
}

export function textoEfectoPromedio(promedio: number | null): string {
  if (promedio == null || !Number.isFinite(promedio)) {
    return 'No tenemos tu promedio para ajustar las becas.'
  }
  const tramo = disminuirArt13(promedio)
  if (tramo.resultado === 'MANTIENE') return 'Las becas que exigen 5,5 se mantienen.'
  if (tramo.resultado === 'PIERDE') return 'Las becas que exigen 5,5 no aplican.'
  const baja = Math.round(tramo.disminucion * 100)
  return `Las becas que exigen 5,5 bajan un ${baja} %.`
}

export function textoAvisoPromedio(promedio: number | null): string {
  if (promedio == null || !Number.isFinite(promedio)) return textoEfectoPromedio(promedio)
  return `Tu promedio es ${textoNotaPromedio(promedio)}. ${textoEfectoPromedio(promedio)}`
}

export function textoPorcentajeFila(fila: FilaBeneficioPromedio): string {
  if (fila.porcCatalogo == null) return 'Sin porcentaje'
  const base = fmtPct(fila.porcCatalogo)
  if (fila.resultado === 'BAJA' && fila.porcAplica != null) {
    return `${base} % · queda en ${fmtPct(fila.porcAplica)} % por tu promedio`
  }
  if (fila.resultado === 'MANTIENE') return `${base} % · se mantiene`
  if (fila.resultado === 'PIERDE') return `${base} % · no aplica por promedio`
  if (fila.resultado === 'SIN_PROMEDIO') return `${base} % · sin promedio para ajustar`
  return `${base} %`
}

function fmtPct(valor: number): string {
  const texto = porcUnaDecimal(valor).toFixed(1).replace('.', ',')
  return texto.endsWith(',0') ? texto.slice(0, -2) : texto
}
