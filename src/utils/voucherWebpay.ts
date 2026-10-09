import type { FilaPublica } from '@/services/webpayPlusApi'

export type LineaVoucher = { etiqueta: string; valor: string }

export type EstadoVoucher = 'autorizada' | 'rechazada' | 'abortada'

export type VoucherWebpay = {
  titulo: string
  estado: EstadoVoucher
  descargable: boolean
  nombreArchivo: string
  tipoTarjeta: string | null
  lineas: LineaVoucher[]
}

export const COMERCIO_VOUCHER = {
  nombre: 'Rematricula Online Uniacc',
  rut: '71.602.500-4',
  direccion: 'Avenida Salvador 1200, Providencia',
  codigo: '597053102249',
} as const

export const PIE_VOUCHER = ['COPIA CLIENTE', 'ACEPTO PAGAR SEGÚN CONTRATO CON EMISOR'] as const

const DEBITO = new Set(['VD', 'VP'])
const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])

function texto(valor: string | null): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function partesFechaChile(iso: string | null): { fecha: string; hora: string } | null {
  const crudo = texto(iso)
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

function montoCl(monto: number): string {
  const miles = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(monto)
  return `$${miles}`
}

function numeroTarjeta(cardLast4: string | null): string | null {
  const digitos = texto(cardLast4).replace(/\D/g, '')
  if (digitos.length < 4) return null
  return `${'*'.repeat(12)}${digitos.slice(-4)}`
}

function tituloDe(estado: EstadoVoucher): string {
  if (estado === 'rechazada') return 'Tu transacción fue rechazada'
  if (estado === 'abortada') return 'Tu transacción fue anulada'
  return 'Tu transacción fue aprobada'
}

function agregar(lineas: LineaVoucher[], etiqueta: string, valor: string | null): void {
  if (!valor) return
  lineas.push({ etiqueta, valor })
}

export function armarVoucherWebpay(fila: FilaPublica): VoucherWebpay | null {
  if (fila.estado === 'creada') return null
  const estado: EstadoVoucher =
    fila.estado === 'rechazada' || fila.estado === 'abortada' ? fila.estado : 'autorizada'
  const autorizacion = texto(fila.authorizationCode)
  const nombre = autorizacion || fila.buyOrder.trim()
  const tipo = texto(fila.paymentTypeCode).toUpperCase()
  const debito = DEBITO.has(tipo)
  const credito = CREDITO.has(tipo)
  const cuando = partesFechaChile(fila.transactionDate)
  const lineas: LineaVoucher[] = []
  agregar(lineas, 'Concepto', fila.concepto === 'matricula' ? 'Matrícula' : 'Arancel')
  agregar(lineas, 'Fecha', cuando?.fecha ?? null)
  agregar(lineas, 'Hora', cuando?.hora ?? null)
  agregar(lineas, 'Número de tarjeta', numeroTarjeta(fila.cardLast4))
  agregar(lineas, 'Monto compra', montoCl(fila.monto))
  agregar(lineas, 'Total', montoCl(fila.monto))
  agregar(lineas, 'Número de operación', fila.buyOrder.trim() || null)
  agregar(lineas, 'Código de autorización', autorizacion || null)
  if (credito) {
    const cuotas =
      fila.installmentsNumber == null || fila.installmentsNumber < 2
        ? '1 cuota'
        : `${Math.trunc(fila.installmentsNumber)} cuotas`
    agregar(lineas, 'Cuotas', cuotas)
  }
  return {
    titulo: tituloDe(estado),
    estado,
    descargable: estado === 'autorizada',
    nombreArchivo: `voucher-${fila.concepto}-${nombre}.pdf`,
    tipoTarjeta: debito ? 'TARJETA DE DÉBITO' : credito ? 'TARJETA DE CRÉDITO' : null,
    lineas,
  }
}
