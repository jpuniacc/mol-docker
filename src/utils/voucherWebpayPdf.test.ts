import { describe, expect, it } from 'vitest'

import type { VoucherWebpay } from '@/utils/voucherWebpay'
import { bytesVoucherWebpay } from '@/utils/voucherWebpayPdf'

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
  })
})
