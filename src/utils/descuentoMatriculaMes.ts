/** Flujo propio del descuento de matrícula del mes. No es beca interna. */
export const FLUJO_DESCUENTO_MATRICULA = 'DESCUENTO_MATRICULA'

export type FilaDescuentoMatriculaMes = {
  id?: number
  /** Código ERP (ej. 2003 = Descuento Matrícula Reintegro). */
  cod_beneficio?: number | null
  nombre: string
  periodo: string
  aplicable_a: string
  monto_descuento: number
  activo: boolean
  vigencia_desde: string
  vigencia_hasta: string
  reserva_hasta?: string | null
}

function esFilaReintegro(fila: FilaDescuentoMatriculaMes): boolean {
  if (Number(fila.cod_beneficio) === 2003) return true
  if (/reintegro/i.test(fila.nombre)) return true
  const desde = ymd(fila.vigencia_desde)
  const hasta = ymd(fila.vigencia_hasta)
  if (/^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return !vigenciaDeUnSoloMes(desde, hasta)
  }
  return false
}

export type ReservaDescuentoMatriculaAplicar = {
  descuentoId: number
  nombre: string
  monto: number
}

export type DescuentoMatriculaDelMes = {
  nombre: string
  monto: number
}

function ymd(iso: string): string {
  return iso.slice(0, 10)
}

/** Fecha calendario de Chile, YYYY-MM-DD. */
export function fechaChileIso(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/** True si nombre o monto del descuento de matrícula difieren (incl. null ↔ valor). */
export function descuentoMatriculaCambio(
  antes: DescuentoMatriculaDelMes | null,
  despues: DescuentoMatriculaDelMes | null,
): boolean {
  if (antes == null && despues == null) return false
  if (antes == null || despues == null) return true
  return antes.nombre !== despues.nombre || antes.monto !== despues.monto
}

/**
 * Ms hasta el instante en que el calendario Chile pasa al día siguiente,
 * más un margen corto para disparar el sync post-medianoche.
 */
export function msHastaProximaMedianocheChile(ahora: Date = new Date()): number {
  const hoy = fechaChileIso(ahora)
  let lo = ahora.getTime()
  let hi = lo + 36 * 60 * 60 * 1000
  while (hi - lo > 250) {
    const mid = Math.floor((lo + hi) / 2)
    if (fechaChileIso(new Date(mid)) === hoy) lo = mid
    else hi = mid
  }
  return Math.max(1000, hi - ahora.getTime() + 750)
}

function vigenciaDeUnSoloMes(desde: string, hasta: string): boolean {
  return desde.slice(0, 7) === hasta.slice(0, 7)
}

/**
 * Fila activa de matrícula del periodo cuya vigencia cabe en un mes
 * y contiene el día indicado. El reintegro queda fuera: su vigencia cruza meses.
 * Con CAE o beca estatal no hay descuento.
 * Si `esReintegro`, prioriza la fila de campaña reintegro (vigencia multi-mes / cód. 2003).
 */
export function filaDescuentoMatriculaDelMes(input: {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
  esReintegro?: boolean
}): DescuentoMatriculaDelMes | null {
  const sel = input.esReintegro ? seleccionReintegro(input) ?? seleccionDelMes(input) : seleccionDelMes(input)
  return sel ? sel.descuento : null
}

/** Descuento aplicado y la fila del catálogo que lo originó. */
export type DescuentoMatriculaConFila = {
  descuento: DescuentoMatriculaDelMes
  fila: FilaDescuentoMatriculaMes
}

type SeleccionInput = {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
  esReintegro?: boolean
}

function candidatosBase(input: SeleccionInput, opts: { soloUnMes: boolean; soloReintegro: boolean }) {
  if (input.tieneCae || input.tieneBecaEstatal) return []
  const periodo = input.periodo.trim()
  const hoy = ymd(input.hoy)
  if (!periodo || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return []

  return input.filas.filter((fila) => {
    if (!fila.activo) return false
    if (fila.aplicable_a !== 'MATRICULA') return false
    if (fila.periodo.trim() !== periodo) return false
    const desde = ymd(fila.vigencia_desde)
    const hasta = ymd(fila.vigencia_hasta)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return false
    if (hoy < desde || hoy > hasta) return false
    if (Number(fila.monto_descuento) <= 0) return false
    const unMes = vigenciaDeUnSoloMes(desde, hasta)
    if (opts.soloUnMes && !unMes) return false
    if (opts.soloReintegro && !esFilaReintegro(fila)) return false
    return true
  })
}

function seleccionDelMes(input: SeleccionInput): DescuentoMatriculaConFila | null {
  const candidatos = candidatosBase(input, { soloUnMes: true, soloReintegro: false })
  candidatos.sort((a, b) => ymd(a.vigencia_desde).localeCompare(ymd(b.vigencia_desde)))
  const fila = candidatos[0]
  if (!fila) return null
  return { descuento: { nombre: fila.nombre.trim(), monto: Number(fila.monto_descuento) }, fila }
}

/** Campaña reintegro: matrícula 100% (fila multi-mes / cód. 2003) si el día cae en su vigencia. */
function seleccionReintegro(input: SeleccionInput): DescuentoMatriculaConFila | null {
  const candidatos = candidatosBase(input, { soloUnMes: false, soloReintegro: true })
  candidatos.sort((a, b) => Number(b.monto_descuento) - Number(a.monto_descuento))
  const fila = candidatos[0]
  if (!fila) return null
  return { descuento: { nombre: fila.nombre.trim(), monto: Number(fila.monto_descuento) }, fila }
}

/**
 * La reserva vigente gana aunque haya CAE o beca estatal y aunque el día
 * ya no caiga en el mes. Si el alumno es reintegro, gana la matrícula 100%
 * de campaña (antes que reserva anticipada del mes). Si no hay reserva usable,
 * queda la regla del mes.
 */
export function descuentoMatriculaParaPago(input: {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
  reserva: ReservaDescuentoMatriculaAplicar | null
  esReintegro?: boolean
}): DescuentoMatriculaDelMes | null {
  return descuentoMatriculaAplicado(input)?.descuento ?? null
}

/** Igual que `descuentoMatriculaParaPago`, pero devuelve también la fila elegida. */
export function descuentoMatriculaAplicado(input: {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
  reserva: ReservaDescuentoMatriculaAplicar | null
  esReintegro?: boolean
}): DescuentoMatriculaConFila | null {
  if (input.esReintegro) {
    const reintegro = seleccionReintegro(input)
    if (reintegro) return reintegro
  }
  const reservado = descuentoDesdeReserva(input.filas, input.hoy, input.reserva)
  if (reservado) return reservado
  return seleccionDelMes(input)
}

function descuentoDesdeReserva(
  filas: FilaDescuentoMatriculaMes[],
  hoy: string,
  reserva: ReservaDescuentoMatriculaAplicar | null,
): DescuentoMatriculaConFila | null {
  if (!reserva || reserva.monto <= 0) return null
  const dia = ymd(hoy)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null
  const fila = filas.find((item) => item.id === reserva.descuentoId)
  if (!fila?.activo) return null
  const hasta = fila.reserva_hasta ? ymd(fila.reserva_hasta) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || dia > hasta) return null
  const nombre = reserva.nombre.trim() || fila.nombre.trim()
  if (!nombre) return null
  return { descuento: { nombre, monto: Number(reserva.monto) }, fila }
}
