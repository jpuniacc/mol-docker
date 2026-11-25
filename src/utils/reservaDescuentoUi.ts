import {
  fmtFechaCalendario,
  fmtMontoDescuento,
} from '@/services/descuentoMatriculaAnticipada'

export type ReservaDescuentoUi = {
  nombre: string
  montoFmt: string
  hasta: string
  /** Matrícula bruta − descuento (mínimo 0), formateado. */
  matriculaPagarFmt: string
  mensajeReserva: string
  mensajeMatriculaPagar: string
}

export function armarReservaDescuentoUi(input: {
  nombre: string
  monto: number
  reservaHasta: string | null | undefined
  /** Valor de matrícula bruto (ERP). Si falta, no se arma el bloque. */
  matriculaBruto: number
}): ReservaDescuentoUi | null {
  const nombre = input.nombre.trim()
  if (!nombre) return null
  if (!Number.isFinite(input.monto)) return null
  if (!Number.isFinite(input.matriculaBruto)) return null
  const hasta = fmtFechaCalendario(input.reservaHasta)
  if (hasta === '—') return null
  const montoFmt = fmtMontoDescuento(input.monto)
  if (montoFmt === '—') return null
  const descuentoAplicado = Math.min(Math.max(0, input.monto), Math.max(0, input.matriculaBruto))
  const matriculaPagar = Math.max(0, input.matriculaBruto - descuentoAplicado)
  const matriculaPagarFmt = fmtMontoDescuento(matriculaPagar)
  if (matriculaPagarFmt === '—') return null
  return {
    nombre,
    montoFmt,
    hasta,
    matriculaPagarFmt,
    mensajeReserva: `Tu descuento de ${montoFmt} seguirá reservado hasta el ${hasta}.`,
    mensajeMatriculaPagar: `El monto de matrícula a pagar es de ${matriculaPagarFmt}.`,
  }
}
