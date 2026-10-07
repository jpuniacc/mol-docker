/**
 * Número de operación del contrato. Con los dos conceptos en Webpay manda la cuenta grabada:
 * un número de pagaré viejo en pagoMatricula no corresponde a esta cuenta.
 */
export function numeroOperacionContrato(
  pago: string | null | undefined,
  cuenta: string | null | undefined,
  opciones: { ambosWebpay?: boolean } = {},
): string {
  const delPago = (pago ?? '').trim()
  const deLaCuenta = (cuenta ?? '').trim()
  if (opciones.ambosWebpay && /^\d+$/.test(deLaCuenta)) return deLaCuenta
  if (/^\d+$/.test(delPago)) return delPago
  if (/^\d+$/.test(deLaCuenta)) return deLaCuenta
  return '—'
}
