import { jsPDF } from 'jspdf'

import { downloadBlob } from '@/utils/planPagoPdf'
import { COMERCIO_VOUCHER, PIE_VOUCHER, type VoucherWebpay } from '@/utils/voucherWebpay'

export function bytesVoucherWebpay(voucher: VoucherWebpay): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = 92
  const x = (doc.internal.pageSize.getWidth() - ancho) / 2
  const pad = 5
  const yInicio = 16
  let y = yInicio + 7

  const centro = (texto: string, tamano: number): void => {
    doc.setFont('courier', 'normal')
    doc.setFontSize(tamano)
    const filas = doc.splitTextToSize(texto, ancho - pad * 2) as string[]
    doc.text(filas, x + ancho / 2, y, { align: 'center' })
    y += filas.length * (tamano * 0.4) + 1.4
  }

  doc.setFont('courier', 'bold')
  doc.setFontSize(11)
  doc.text('COMPROBANTE DE VENTA', x + ancho / 2, y, { align: 'center' })
  y += 6
  if (voucher.tipoTarjeta) centro(voucher.tipoTarjeta, 10)
  centro(COMERCIO_VOUCHER.nombre, 9)
  centro(COMERCIO_VOUCHER.direccion, 8)
  centro(`RUT ${COMERCIO_VOUCHER.rut}`, 8)
  centro(COMERCIO_VOUCHER.codigo, 8)
  y += 1
  doc.setDrawColor(80)
  doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(x + pad, y, x + ancho - pad, y)
  doc.setLineDashPattern([], 0)
  y += 5

  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  for (const linea of voucher.lineas) {
    const valor = doc.splitTextToSize(linea.valor, ancho * 0.46) as string[]
    doc.text(linea.etiqueta, x + pad, y)
    doc.text(valor, x + ancho - pad, y, { align: 'right' })
    y += 4.2 + (valor.length - 1) * 3.6
  }

  y += 1
  doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(x + pad, y, x + ancho - pad, y)
  doc.setLineDashPattern([], 0)
  y += 5
  for (const pie of PIE_VOUCHER) centro(pie, 8)
  doc.rect(x, yInicio, ancho, y - yInicio + 1)

  return new Uint8Array(doc.output('arraybuffer'))
}

export function descargarVoucherWebpay(voucher: VoucherWebpay): void {
  if (!voucher.descargable) return
  downloadBlob(bytesVoucherWebpay(voucher), voucher.nombreArchivo)
}
