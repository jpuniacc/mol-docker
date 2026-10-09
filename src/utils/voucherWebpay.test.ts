import { describe, expect, it } from 'vitest'

import type { FilaPublica } from '@/services/webpayPlusApi'
import { armarVoucherWebpay } from '@/utils/voucherWebpay'

function fila(parcial: Partial<FilaPublica>): FilaPublica {
  return {
    buyOrder: '197407692027-1-15',
    sessionId: 's',
    concepto: 'matricula',
    codcli: '19740769',
    anioPeriodo: 2027,
    semestrePeriodo: 1,
    correlativo: 15,
    monto: 250000,
    estado: 'autorizada',
    authorizationCode: '1415',
    responseCode: 0,
    paymentTypeCode: 'VD',
    installmentsNumber: 0,
    cardLast4: '7763',
    transactionDate: '2026-10-08T20:40:00.000Z',
    ambiente: 'integracion',
    ...parcial,
  }
}

function valor(lineas: { etiqueta: string; valor: string }[], etiqueta: string): string | undefined {
  return lineas.find((l) => l.etiqueta === etiqueta)?.valor
}

describe('armarVoucherWebpay', () => {
  it('arma el débito aprobado de matrícula', () => {
    const voucher = armarVoucherWebpay(fila({}))
    expect(voucher).toMatchObject({
      titulo: 'Tu transacción fue aprobada',
      descargable: true,
      nombreArchivo: 'voucher-matricula-1415.pdf',
    })
    expect(voucher?.lineas.map((l) => l.etiqueta)).toEqual([
      'Concepto',
      'Fecha y hora',
      'Código de autorización',
      'Monto',
      'Tipo de tarjeta',
      'Tarjeta',
    ])
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Matrícula')
    expect(valor(voucher!.lineas, 'Fecha y hora')).toBe('08-10-2026 17:40')
    expect(valor(voucher!.lineas, 'Código de autorización')).toBe('1415')
    expect(valor(voucher!.lineas, 'Monto')).toBe('250.000')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Débito')
    expect(valor(voucher!.lineas, 'Tarjeta')).toBe('•••• 7763')
  })

  it('trata el prepago como débito y sin cuotas', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'VP' }))
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Débito')
    expect(voucher!.lineas.some((l) => l.etiqueta === 'Cuotas')).toBe(false)
  })

  it('el crédito de una cuota dice 1 cuota', () => {
    const voucher = armarVoucherWebpay(
      fila({ paymentTypeCode: 'VN', installmentsNumber: 0, concepto: 'arancel', monto: 3933000, authorizationCode: '1819' }),
    )
    expect(voucher?.nombreArchivo).toBe('voucher-arancel-1819.pdf')
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Arancel')
    expect(valor(voucher!.lineas, 'Monto')).toBe('3.933.000')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Crédito')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('1 cuota')
  })

  it('el crédito de varias cuotas dice el número', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'VC', installmentsNumber: 6 }))
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('6 cuotas')
  })

  it('el rechazo no se descarga y usa raya donde falta el dato', () => {
    const voucher = armarVoucherWebpay(
      fila({
        estado: 'rechazada',
        authorizationCode: '  ',
        transactionDate: null,
        cardLast4: null,
        paymentTypeCode: null,
      }),
    )
    expect(voucher).toMatchObject({
      titulo: 'Tu transacción fue rechazada',
      descargable: false,
      nombreArchivo: 'voucher-matricula-197407692027-1-15.pdf',
    })
    expect(valor(voucher!.lineas, 'Código de autorización')).toBe('—')
    expect(valor(voucher!.lineas, 'Fecha y hora')).toBe('—')
    expect(valor(voucher!.lineas, 'Tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('—')
    expect(valor(voucher!.lineas, 'Monto')).toBe('250.000')
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Matrícula')
  })

  it('la anulación tiene su título', () => {
    const voucher = armarVoucherWebpay(fila({ estado: 'abortada', paymentTypeCode: 'VD' }))
    expect(voucher?.titulo).toBe('Tu transacción fue anulada')
    expect(voucher?.descargable).toBe(false)
    expect(voucher?.lineas.some((l) => l.etiqueta === 'Cuotas')).toBe(false)
  })

  it('un tipo desconocido deja tipo y cuotas en raya', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'XX' }))
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('—')
  })

  it('una transacción creada no arma voucher', () => {
    expect(armarVoucherWebpay(fila({ estado: 'creada' }))).toBeNull()
  })
})
