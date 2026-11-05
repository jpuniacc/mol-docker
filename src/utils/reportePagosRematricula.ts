export type MedioPago = 'webpay' | 'pagare' | 'pendiente'
export type Concepto = 'matricula' | 'arancel'

export type FilaReportePagosRematricula = {
  codcli: string
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  codigo_carrera: string | null
  nombre_carrera: string | null
  fec_mat: string | null
  medio_matricula: MedioPago
  monto_matricula: number | null
  fecha_pago_matricula: string | null
  buy_order_matricula: string | null
  cuotas_matricula: number | null
  medio_arancel: MedioPago
  monto_arancel: number | null
  fecha_pago_arancel: string | null
  buy_order_arancel: string | null
  cuotas_arancel: number | null
  fecha_inicio_pagare: string | null
}

export type ResumenConcepto = {
  webpay: number
  webpay_monto: number
  pagare: number
  pagare_monto: number
  pendiente: number
}

export type KpiReportePagosRematricula = {
  matriculados_mol: number
  matriculados_hoy: number
  matriculados_7d: number
  matricula: ResumenConcepto
  arancel: ResumenConcepto
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (v == null ? null : String(v))

export function normalizarMedio(v: unknown): MedioPago {
  const s = String(v ?? '').toLowerCase()
  return s === 'webpay' || s === 'pagare' ? s : 'pendiente'
}

/**
 * Misma regla que listar_reporte_pagos_rematricula:
 * pagaré declarado manda; si no, tx Webpay autorizada → webpay (aunque el borrador no tenga medio).
 */
export function resolverMedioReporte(
  medioBorrador: unknown,
  tieneWebpayAutorizada: boolean,
): MedioPago {
  if (String(medioBorrador ?? '').toLowerCase() === 'pagare') return 'pagare'
  if (tieneWebpayAutorizada) return 'webpay'
  return 'pendiente'
}

export function parseFilaReportePagos(raw: unknown): FilaReportePagosRematricula | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codcli = String(r.codcli ?? '').trim()
  if (!codcli) return null
  return {
    codcli,
    rut: str(r.rut),
    rut_norm: str(r.rut_norm),
    nombre_alumno: str(r.nombre_alumno),
    codigo_carrera: str(r.codigo_carrera),
    nombre_carrera: str(r.nombre_carrera),
    fec_mat: str(r.fec_mat),
    medio_matricula: normalizarMedio(r.medio_matricula),
    monto_matricula: num(r.monto_matricula),
    fecha_pago_matricula: str(r.fecha_pago_matricula),
    buy_order_matricula: str(r.buy_order_matricula),
    cuotas_matricula: num(r.cuotas_matricula),
    medio_arancel: normalizarMedio(r.medio_arancel),
    monto_arancel: num(r.monto_arancel),
    fecha_pago_arancel: str(r.fecha_pago_arancel),
    buy_order_arancel: str(r.buy_order_arancel),
    cuotas_arancel: num(r.cuotas_arancel),
    fecha_inicio_pagare: str(r.fecha_inicio_pagare),
  }
}

export function parseKpiReportePagos(raw: unknown): KpiReportePagosRematricula {
  const row = Array.isArray(raw) ? raw[0] : raw
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
  const n = (k: string) => Number(r[k] ?? 0) || 0
  const c = (p: 'mat' | 'ara'): ResumenConcepto => ({
    webpay: n(`${p}_webpay_alumnos`),
    webpay_monto: n(`${p}_webpay_monto`),
    pagare: n(`${p}_pagare_alumnos`),
    pagare_monto: n(`${p}_pagare_monto`),
    pendiente: n(`${p}_pendiente_alumnos`),
  })
  return {
    matriculados_mol: n('matriculados_mol'),
    matriculados_hoy: n('matriculados_hoy'),
    matriculados_7d: n('matriculados_7d'),
    matricula: c('mat'),
    arancel: c('ara'),
  }
}

export function medioDe(f: FilaReportePagosRematricula, c: Concepto): MedioPago {
  return c === 'matricula' ? f.medio_matricula : f.medio_arancel
}

/** Resumen calculado en cliente (para filtros locales y gráficos). */
export function resumirConcepto(filas: FilaReportePagosRematricula[], c: Concepto): ResumenConcepto {
  const out: ResumenConcepto = { webpay: 0, webpay_monto: 0, pagare: 0, pagare_monto: 0, pendiente: 0 }
  for (const f of filas) {
    const m = medioDe(f, c)
    const monto = (c === 'matricula' ? f.monto_matricula : f.monto_arancel) ?? 0
    if (m === 'webpay') {
      out.webpay++
      out.webpay_monto += monto
    } else if (m === 'pagare') {
      out.pagare++
      out.pagare_monto += monto
    } else out.pendiente++
  }
  return out
}

export type FiltroChip = 'todos' | `${Concepto}:${MedioPago}`

export function aplicaChip(f: FilaReportePagosRematricula, chip: FiltroChip): boolean {
  if (chip === 'todos') return true
  const [c, m] = chip.split(':') as [Concepto, MedioPago]
  return medioDe(f, c) === m
}

export type FiltroMedio = 'todos' | 'webpay' | 'pagare' | 'pendiente'
/** Medio en cualquiera de los dos conceptos. */
export function aplicaMedio(f: FilaReportePagosRematricula, m: FiltroMedio): boolean {
  return m === 'todos' || f.medio_matricula === m || f.medio_arancel === m
}

export type PuntoSerie = { fecha: string; dia: number; acumulado: number; acumuladoConMedio: number }

function diaSantiago(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

/** Serie diaria acumulada desde fec_mat. */
export function serieDiaria(filas: FilaReportePagosRematricula[]): PuntoSerie[] {
  const porDia = new Map<string, { n: number; m: number }>()
  for (const f of filas) {
    if (!f.fec_mat) continue
    const d = diaSantiago(f.fec_mat)
    if (!d) continue
    const e = porDia.get(d) ?? { n: 0, m: 0 }
    e.n++
    if (f.medio_matricula !== 'pendiente') e.m++
    porDia.set(d, e)
  }
  let acc = 0
  let accM = 0
  return [...porDia.keys()].sort().map((fecha) => {
    const e = porDia.get(fecha)!
    acc += e.n
    accM += e.m
    return { fecha, dia: e.n, acumulado: acc, acumuladoConMedio: accM }
  })
}

export type FilaCarrera = { carrera: string; total: number; webpay: number; pagare: number; pendiente: number }

export function porCarrera(filas: FilaReportePagosRematricula[], c: Concepto, top = 8): FilaCarrera[] {
  const map = new Map<string, FilaCarrera>()
  for (const f of filas) {
    const k = f.nombre_carrera?.trim() || 'Sin carrera'
    const e = map.get(k) ?? { carrera: k, total: 0, webpay: 0, pagare: 0, pendiente: 0 }
    e.total++
    e[medioDe(f, c)]++
    map.set(k, e)
  }
  const arr = [...map.values()].sort((a, b) => b.total - a.total)
  if (arr.length <= top) return arr
  const resto = arr.slice(top - 1)
  const otras: FilaCarrera = { carrera: `Otras (${resto.length})`, total: 0, webpay: 0, pagare: 0, pendiente: 0 }
  for (const r of resto) {
    otras.total += r.total
    otras.webpay += r.webpay
    otras.pagare += r.pagare
    otras.pendiente += r.pendiente
  }
  return [...arr.slice(0, top - 1), otras]
}

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  webpay: 'Webpay',
  pagare: 'Pagaré',
  pendiente: 'Sin definir',
}

/** Texto del empty state (wireframe): cita búsqueda y filtros activos. */
export function mensajeEmptyReportePagos(input: {
  q: string
  carrera: string
  medio: FiltroMedio
  periodoLabel: string
}): string {
  const q = input.q.trim()
  const partes: string[] = []
  if (input.carrera.trim()) partes.push(`Carrera: ${input.carrera.trim()}`)
  if (input.medio !== 'todos') partes.push(ETIQUETA_MEDIO[input.medio])
  const filtros = partes.length ? ` (${partes.join(' · ')})` : ''
  const busqueda = q ? ` para «${q}»` : ''
  return `Sin resultados${busqueda}. No hay matriculados MOL en ${input.periodoLabel} que coincidan con la búsqueda y los filtros${filtros}.`
}

const COLUMNAS = [
  'codcli', 'rut', 'nombre', 'carrera', 'fecha_matricula',
  'medio_matricula', 'monto_matricula', 'fecha_pago_matricula', 'cuotas_matricula', 'buy_order_matricula',
  'medio_arancel', 'monto_arancel', 'fecha_pago_arancel', 'cuotas_arancel', 'buy_order_arancel',
  'fecha_inicio_pagare',
] as const

export function filasReportePagosAMatriz(filas: FilaReportePagosRematricula[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLUMNAS]]
  for (const f of filas) {
    rows.push([
      f.codcli, f.rut ?? '', f.nombre_alumno ?? '', f.nombre_carrera ?? '', f.fec_mat ?? '',
      ETIQUETA_MEDIO[f.medio_matricula], f.monto_matricula ?? '', f.fecha_pago_matricula ?? '',
      f.cuotas_matricula ?? '', f.buy_order_matricula ?? '',
      ETIQUETA_MEDIO[f.medio_arancel], f.monto_arancel ?? '', f.fecha_pago_arancel ?? '',
      f.cuotas_arancel ?? '', f.buy_order_arancel ?? '', f.fecha_inicio_pagare ?? '',
    ])
  }
  return rows
}

function csvEscape(value: string): string {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function filasReportePagosACsv(filas: FilaReportePagosRematricula[]): string {
  return filasReportePagosAMatriz(filas)
    .map((r) => r.map((c) => csvEscape(String(c))).join(','))
    .join('\n')
}
