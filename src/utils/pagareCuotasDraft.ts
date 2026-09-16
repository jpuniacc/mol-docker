export const PAGARE_TIPODOC = 5
/** Default de cuotas pagaré (matrícula y arancel). */
export const PAGARE_TOTAL_CUOTAS = 10 as const

export type PagareTotalCuotas = 10 | 12
export type PagareDiaVencimiento = 5 | 15 | 25
export type PagareItemConcepto = 'MATRICULA' | 'ARANCEL'

export type CuotaPagareDraftRow = {
  documento: 'PAGARÉ'
  correlativo: string
  vencimiento: string
  monto: number
  totalAcumulado: number
  items: PagareItemConcepto
  item: 1 | 2
  cuota: number
  totalCuotas: PagareTotalCuotas
  idDocumento: typeof PAGARE_TIPODOC
  ctapagnum: string
  ctadocnum: string
  seleccionado: boolean
}

export function hoyIsoLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addMonthsSameDay(isoYmd: string, months: number): string {
  const [y, m, d] = isoYmd.split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return hoyIsoLocal(dt)
}

/** Incrementa un peek numérico (string) sin roundtrip a UMAS. */
export function incrementPeek(preview: string, delta: number): string {
  const t = preview.trim()
  if (!/^\d+$/.test(t)) {
    throw new Error(`Peek no numérico: ${preview}`)
  }
  return (BigInt(t) + BigInt(delta)).toString()
}

/** Folio de cuota U+: ctapagnum concatenado con 01..N. */
export function folioCuota(ctapagnum: string, cuota: number): string {
  return `${ctapagnum.trim()}${String(cuota).padStart(2, '0')}`
}

export function splitMontoEnCuotas(total: number, n: number): number[] {
  if (n < 1) throw new Error('n debe ser >= 1')
  const entero = Math.round(total)
  const base = Math.floor(entero / n)
  const out: number[] = []
  let acumulado = 0
  for (let i = 1; i <= n; i++) {
    const monto = i === n ? entero - acumulado : base
    out.push(monto)
    acumulado += monto
  }
  return out
}

export type PagareCuotasDraftInput = {
  fechaInicio: string
  dia: PagareDiaVencimiento
  montoMat: number
  montoAra: number
  corrpagMat: string
  corrpagAra: string
  n?: PagareTotalCuotas
  hoy?: string
}

export type PagareCuotasDraftResult =
  | { ok: true; rows: CuotaPagareDraftRow[] }
  | { ok: false; error: string }

function serieCuotas(opts: {
  fechaInicio: string
  montos: number[]
  ctapagnum: string
  items: PagareItemConcepto
  item: 1 | 2
  totalCuotas: PagareTotalCuotas
}): CuotaPagareDraftRow[] {
  const n = opts.montos.length
  const rows: CuotaPagareDraftRow[] = []
  let acumulado = 0
  for (let i = 1; i <= n; i++) {
    const monto = opts.montos[i - 1]
    acumulado += monto
    const ctadocnum = folioCuota(opts.ctapagnum, i)
    rows.push({
      documento: 'PAGARÉ',
      correlativo: ctadocnum,
      vencimiento: addMonthsSameDay(opts.fechaInicio, i - 1),
      monto,
      totalAcumulado: acumulado,
      items: opts.items,
      item: opts.item,
      cuota: i,
      totalCuotas: opts.totalCuotas,
      idDocumento: PAGARE_TIPODOC,
      ctapagnum: opts.ctapagnum,
      ctadocnum,
      seleccionado: true,
    })
  }
  return rows
}

function asPagareTotalCuotas(n: number): PagareTotalCuotas | null {
  return n === 10 || n === 12 ? n : null
}

export function buildPagareCuotasDraft(
  input: PagareCuotasDraftInput,
): PagareCuotasDraftResult {
  const n = asPagareTotalCuotas(input.n ?? PAGARE_TOTAL_CUOTAS)
  if (n == null) {
    return { ok: false, error: 'Cantidad de cuotas inválida (10 o 12)' }
  }
  const hoy = input.hoy ?? hoyIsoLocal()
  const fecha = input.fechaInicio.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: 'Fecha de inicio inválida' }
  }
  if (fecha < hoy) {
    return { ok: false, error: 'Fecha de inicio inválida' }
  }
  if (Number(fecha.slice(8, 10)) !== input.dia) {
    return { ok: false, error: `La fecha de inicio debe caer el día ${input.dia}` }
  }
  const corrMat = input.corrpagMat.trim()
  const corrAra = input.corrpagAra.trim()
  if (!/^\d+$/.test(corrMat) || !/^\d+$/.test(corrAra)) {
    return { ok: false, error: 'Falta peek CORRPAGNUM del preflight' }
  }
  if (!Number.isFinite(input.montoMat) || input.montoMat < 0) {
    return { ok: false, error: 'Monto de matrícula inválido' }
  }
  if (!Number.isFinite(input.montoAra) || input.montoAra < 0) {
    return { ok: false, error: 'Monto de arancel inválido' }
  }

  const rows = [
    ...serieCuotas({
      fechaInicio: fecha,
      montos: splitMontoEnCuotas(input.montoMat, n),
      ctapagnum: corrMat,
      items: 'MATRICULA',
      item: 1,
      totalCuotas: n,
    }),
    ...serieCuotas({
      fechaInicio: fecha,
      montos: splitMontoEnCuotas(input.montoAra, n),
      ctapagnum: corrAra,
      items: 'ARANCEL',
      item: 2,
      totalCuotas: n,
    }),
  ]
  return { ok: true, rows }
}
