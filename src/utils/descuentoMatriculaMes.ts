/** Flujo propio del descuento de matrícula del mes. No es beca interna. */
export const FLUJO_DESCUENTO_MATRICULA = 'DESCUENTO_MATRICULA'

export type FilaDescuentoMatriculaMes = {
  id?: number
  nombre: string
  periodo: string
  aplicable_a: string
  monto_descuento: number
  activo: boolean
  vigencia_desde: string
  vigencia_hasta: string
  reserva_hasta?: string | null
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

function vigenciaDeUnSoloMes(desde: string, hasta: string): boolean {
  return desde.slice(0, 7) === hasta.slice(0, 7)
}

/**
 * Fila activa de matrícula del periodo cuya vigencia cabe en un mes
 * y contiene el día indicado. El reintegro queda fuera: su vigencia cruza meses.
 * Con CAE o beca estatal no hay descuento.
 */
export function filaDescuentoMatriculaDelMes(input: {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
}): DescuentoMatriculaDelMes | null {
  if (input.tieneCae || input.tieneBecaEstatal) return null
  const periodo = input.periodo.trim()
  const hoy = ymd(input.hoy)
  if (!periodo || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return null

  const candidatos = input.filas.filter((fila) => {
    if (!fila.activo) return false
    if (fila.aplicable_a !== 'MATRICULA') return false
    if (fila.periodo.trim() !== periodo) return false
    const desde = ymd(fila.vigencia_desde)
    const hasta = ymd(fila.vigencia_hasta)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return false
    if (!vigenciaDeUnSoloMes(desde, hasta)) return false
    if (hoy < desde || hoy > hasta) return false
    return Number(fila.monto_descuento) > 0
  })

  candidatos.sort((a, b) => ymd(a.vigencia_desde).localeCompare(ymd(b.vigencia_desde)))
  const fila = candidatos[0]
  if (!fila) return null
  return { nombre: fila.nombre.trim(), monto: Number(fila.monto_descuento) }
}

/**
 * La reserva vigente gana aunque haya CAE o beca estatal y aunque el día
 * ya no caiga en el mes. Si no hay reserva usable, queda la regla del mes.
 */
export function descuentoMatriculaParaPago(input: {
  filas: FilaDescuentoMatriculaMes[]
  periodo: string
  hoy: string
  tieneCae: boolean
  tieneBecaEstatal: boolean
  reserva: ReservaDescuentoMatriculaAplicar | null
}): DescuentoMatriculaDelMes | null {
  const reservado = descuentoDesdeReserva(input.filas, input.hoy, input.reserva)
  if (reservado) return reservado
  return filaDescuentoMatriculaDelMes(input)
}

function descuentoDesdeReserva(
  filas: FilaDescuentoMatriculaMes[],
  hoy: string,
  reserva: ReservaDescuentoMatriculaAplicar | null,
): DescuentoMatriculaDelMes | null {
  if (!reserva || reserva.monto <= 0) return null
  const dia = ymd(hoy)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null
  const fila = filas.find((item) => item.id === reserva.descuentoId)
  if (!fila?.activo) return null
  const hasta = fila.reserva_hasta ? ymd(fila.reserva_hasta) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || dia > hasta) return null
  const nombre = reserva.nombre.trim() || fila.nombre.trim()
  if (!nombre) return null
  return { nombre, monto: Number(reserva.monto) }
}
