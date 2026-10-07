export function numeroOperacionContrato(
  pago: string | null | undefined,
  cuenta: string | null | undefined,
): string {
  const delPago = (pago ?? '').trim()
  if (/^\d+$/.test(delPago)) return delPago
  const deLaCuenta = (cuenta ?? '').trim()
  if (/^\d+$/.test(deLaCuenta)) return deLaCuenta
  return '—'
}
