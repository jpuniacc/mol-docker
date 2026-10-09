import type { FilaPublica } from '@/services/webpayPlusApi'

export type LineaVoucher = { etiqueta: string; valor: string }

export type VoucherWebpay = {
  titulo: string
  descargable: boolean
  nombreArchivo: string
  lineas: LineaVoucher[]
}

const RAYA = '—'
const DEBITO = new Set(['VD', 'VP'])
const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])

function texto(valor: string | null): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function fechaHoraChile(iso: string | null): string {
  const crudo = texto(iso)
  if (!crudo) return RAYA
  const fecha = new Date(crudo)
  if (Number.isNaN(fecha.getTime())) return RAYA
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
  return `${leer('day')}-${leer('month')}-${leer('year')} ${leer('hour')}:${leer('minute')}`
}

function montoCl(monto: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(monto)
}

function ultimos4(cardLast4: string | null): string {
  const digitos = texto(cardLast4).replace(/\D/g, '')
  if (digitos.length < 4) return RAYA
  return `•••• ${digitos.slice(-4)}`
}

function tituloDe(estado: FilaPublica['estado']): string {
  if (estado === 'rechazada') return 'Tu transacción fue rechazada'
  if (estado === 'abortada') return 'Tu transacción fue anulada'
  return 'Tu transacción fue aprobada'
}

export function armarVoucherWebpay(fila: FilaPublica): VoucherWebpay | null {
  if (fila.estado === 'creada') return null
  const tipo = texto(fila.paymentTypeCode).toUpperCase()
  const debito = DEBITO.has(tipo)
  const credito = CREDITO.has(tipo)
  const autorizacion = texto(fila.authorizationCode)
  const lineas: LineaVoucher[] = [
    { etiqueta: 'Concepto', valor: fila.concepto === 'matricula' ? 'Matrícula' : 'Arancel' },
    { etiqueta: 'Fecha y hora', valor: fechaHoraChile(fila.transactionDate) },
    { etiqueta: 'Código de autorización', valor: autorizacion || RAYA },
    { etiqueta: 'Monto', valor: montoCl(fila.monto) },
    { etiqueta: 'Tipo de tarjeta', valor: debito ? 'Débito' : credito ? 'Crédito' : RAYA },
    { etiqueta: 'Tarjeta', valor: ultimos4(fila.cardLast4) },
  ]
  if (!debito) {
    const cuotas =
      !credito
        ? RAYA
        : fila.installmentsNumber == null || fila.installmentsNumber < 2
          ? '1 cuota'
          : `${Math.trunc(fila.installmentsNumber)} cuotas`
    lineas.push({ etiqueta: 'Cuotas', valor: cuotas })
  }
  const nombre = autorizacion || fila.buyOrder.trim()
  return {
    titulo: tituloDe(fila.estado),
    descargable: fila.estado === 'autorizada',
    nombreArchivo: `voucher-${fila.concepto}-${nombre}.pdf`,
    lineas,
  }
}
