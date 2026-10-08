export type WebpayPagoDetalle = {
  forma: 'debito' | 'credito'
  autorizacion: string
  /** null en débito. En crédito, 1 es contado y 2 o más son cuotas. */
  cuotas: number | null
}

const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])
const DEBITO = new Set(['VD', 'VP'])

export function detalleDesdeWebpay(input: {
  paymentTypeCode: string | null
  authorizationCode: string | null
  installmentsNumber: number | null
}): WebpayPagoDetalle | null {
  const tipo = (input.paymentTypeCode ?? '').trim().toUpperCase()
  const forma = DEBITO.has(tipo) ? 'debito' : CREDITO.has(tipo) ? 'credito' : null
  if (!forma) return null
  const cuotas =
    forma === 'debito'
      ? null
      : input.installmentsNumber == null || input.installmentsNumber < 2
        ? 1
        : Math.trunc(input.installmentsNumber)
  return {
    forma,
    autorizacion: (input.authorizationCode ?? '').trim(),
    cuotas,
  }
}

export function textoWebpayAprobado(
  etiqueta: 'Pagada' | 'Pagado',
  detalle: WebpayPagoDetalle | null,
): string {
  if (!detalle) return etiqueta
  const partes = [etiqueta, detalle.forma === 'debito' ? 'Débito' : 'Crédito']
  if (detalle.cuotas != null) {
    partes.push(detalle.cuotas === 1 ? '1 cuota' : `${detalle.cuotas} cuotas`)
  }
  if (detalle.autorizacion) partes.push(`Autorización ${detalle.autorizacion}`)
  return partes.join(' · ')
}
