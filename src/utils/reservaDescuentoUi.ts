import {
  fmtFechaCalendario,
  fmtMontoDescuento,
} from '@/services/descuentoMatriculaAnticipada'

export type ReservaDescuentoUi = {
  nombre: string
  montoFmt: string
  hasta: string
}

export function armarReservaDescuentoUi(input: {
  nombre: string
  monto: number
  reservaHasta: string | null | undefined
}): ReservaDescuentoUi | null {
  const nombre = input.nombre.trim()
  if (!nombre) return null
  if (!Number.isFinite(input.monto)) return null
  const hasta = fmtFechaCalendario(input.reservaHasta)
  if (hasta === '—') return null
  const montoFmt = fmtMontoDescuento(input.monto)
  if (montoFmt === '—') return null
  return { nombre, montoFmt, hasta }
}
