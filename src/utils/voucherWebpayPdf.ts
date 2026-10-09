import { jsPDF } from 'jspdf'

import { downloadBlob } from '@/utils/planPagoPdf'
import type { VoucherWebpay } from '@/utils/voucherWebpay'

export function bytesVoucherWebpay(voucher: VoucherWebpay): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margen = 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(voucher.titulo, margen, 28)
  doc.setFontSize(11)
  let y = 42
  for (const linea of voucher.lineas) {
    doc.setFont('helvetica', 'normal')
    doc.text(linea.etiqueta, margen, y)
    doc.setFont('helvetica', 'bold')
    const valor = doc.splitTextToSize(linea.valor, 110) as string[]
    doc.text(valor, doc.internal.pageSize.getWidth() - margen, y, { align: 'right' })
    y += 8 + (valor.length - 1) * 5
  }
  return new Uint8Array(doc.output('arraybuffer'))
}

export function descargarVoucherWebpay(voucher: VoucherWebpay): void {
  if (!voucher.descargable) return
  downloadBlob(bytesVoucherWebpay(voucher), voucher.nombreArchivo)
}
