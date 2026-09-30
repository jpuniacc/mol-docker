/** Flujo propio del descuento de matrícula del mes. No es beca interna. */
export const FLUJO_DESCUENTO_MATRICULA = 'DESCUENTO_MATRICULA'

export type FilaDescuentoMatriculaMes = {
  nombre: string
  periodo: string
  aplicable_a: string
  monto_descuento: number
  activo: boolean
  vigencia_desde: string
  vigencia_hasta: string
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
