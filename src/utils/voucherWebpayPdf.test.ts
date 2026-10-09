import { describe, expect, it, vi } from 'vitest'

import type { VoucherWebpay } from '@/utils/voucherWebpay'
import { bytesVoucherWebpay, descargarVoucherWebpay } from '@/utils/voucherWebpayPdf'

vi.mock('@/utils/planPagoPdf', () => ({
  downloadBlob: vi.fn(),
}))

import { downloadBlob } from '@/utils/planPagoPdf'

const voucher: VoucherWebpay = {
  titulo: 'Tu transacción fue aprobada',
  descargable: true,
  nombreArchivo: 'voucher-matricula-1415.pdf',
  lineas: [
    { etiqueta: 'Concepto', valor: 'Matrícula' },
    { etiqueta: 'Monto', valor: '250.000' },
  ],
}

describe('bytesVoucherWebpay', () => {
  it('devuelve un PDF A4', () => {
    const bytes = bytesVoucherWebpay(voucher)
    expect(bytes[0]).toBe(0x25)
    expect(bytes[1]).toBe(0x50)
    expect(bytes[2]).toBe(0x44)
    expect(bytes[3]).toBe(0x46)
    expect(bytes.byteLength).toBeGreaterThan(500)
    const texto = new TextDecoder('latin1').decode(bytes)
    const mediaBox = texto.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
    expect(mediaBox).not.toBeNull()
    expect(Number(mediaBox![1])).toBeCloseTo(595.28, 0)
    expect(Number(mediaBox![2])).toBeCloseTo(841.89, 0)
  })
})

describe('descargarVoucherWebpay', () => {
  it('no llama a downloadBlob si descargable es false', () => {
    vi.mocked(downloadBlob).mockClear()
    descargarVoucherWebpay({ ...voucher, descargable: false })
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
