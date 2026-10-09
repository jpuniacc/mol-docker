export type WebpayPagoDetalle = {
  forma: 'debito' | 'credito'
  autorizacion: string
  /** null en débito. En crédito, 1 es contado y 2 o más son cuotas. */
  cuotas: number | null
  fecha: string | null
  hora: string | null
  ultimos4: string | null
}

const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])
const DEBITO = new Set(['VD', 'VP'])

function partesFechaChile(iso: string | null): { fecha: string; hora: string } | null {
  const crudo = (iso ?? '').trim()
  if (!crudo) return null
  const fecha = new Date(crudo)
  if (Number.isNaN(fecha.getTime())) return null
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  const leer = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  const dia = leer('day')
  const hora = leer('hour')
  if (!dia || !hora) return null
  return {
    fecha: `${dia}-${leer('month')}-${leer('year')}`,
    hora: `${hora}:${leer('minute')}`,
  }
}

function ultimos4(cardLast4: string | null): string | null {
  const digitos = (cardLast4 ?? '').replace(/\D/g, '')
  return digitos.length >= 4 ? digitos.slice(-4) : null
}

export function detalleDesdeWebpay(input: {
  paymentTypeCode: string | null
  authorizationCode: string | null
  installmentsNumber: number | null
  transactionDate?: string | null
  cardLast4?: string | null
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
  const cuando = partesFechaChile(input.transactionDate ?? null)
  return {
    forma,
    autorizacion: (input.authorizationCode ?? '').trim(),
    cuotas,
    fecha: cuando?.fecha ?? null,
    hora: cuando?.hora ?? null,
    ultimos4: ultimos4(input.cardLast4 ?? null),
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
