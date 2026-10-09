import { describe, expect, it } from 'vitest'

import { detalleDesdeWebpay, textoWebpayAprobado } from '@/utils/webpayPagoDetalle'

describe('detalleDesdeWebpay', () => {
  it('débito no informa cuotas', () => {
    expect(
      detalleDesdeWebpay({
        paymentTypeCode: 'VD',
        authorizationCode: '1213',
        installmentsNumber: 0,
      }),
    ).toEqual({
      forma: 'debito',
      autorizacion: '1213',
      cuotas: null,
      fecha: null,
      hora: null,
      ultimos4: null,
    })
  })

  it('crédito de una cuota', () => {
    expect(
      detalleDesdeWebpay({
        paymentTypeCode: 'VN',
        authorizationCode: '99',
        installmentsNumber: 0,
      }),
    ).toEqual({
      forma: 'credito',
      autorizacion: '99',
      cuotas: 1,
      fecha: null,
      hora: null,
      ultimos4: null,
    })
  })

  it('crédito en varias cuotas', () => {
    expect(
      detalleDesdeWebpay({
        paymentTypeCode: 'VC',
        authorizationCode: '555',
        installmentsNumber: 6,
      })?.cuotas,
    ).toBe(6)
  })

  it('un tipo desconocido no arma detalle', () => {
    expect(
      detalleDesdeWebpay({
        paymentTypeCode: 'XX',
        authorizationCode: '1',
        installmentsNumber: 3,
      }),
    ).toBeNull()
  })
})

describe('textoWebpayAprobado', () => {
  it('arma débito sin cuotas', () => {
    expect(
      textoWebpayAprobado('Pagada', {
        forma: 'debito',
        autorizacion: '1213',
        cuotas: null,
        fecha: null,
        hora: null,
        ultimos4: null,
      }),
    ).toBe('Pagada · Débito · Autorización 1213')
  })

  it('guarda fecha, hora y últimos 4 dígitos', () => {
    expect(
      detalleDesdeWebpay({
        paymentTypeCode: 'VN',
        authorizationCode: '1213',
        installmentsNumber: 1,
        transactionDate: '2026-10-09T17:16:00.000Z',
        cardLast4: '6623',
      }),
    ).toMatchObject({
      fecha: '09-10-2026',
      hora: '14:16',
      ultimos4: '6623',
      cuotas: 1,
    })
  })

  it('arma crédito con cuotas', () => {
    expect(
      textoWebpayAprobado('Pagado', {
        forma: 'credito',
        autorizacion: '555',
        cuotas: 6,
        fecha: null,
        hora: null,
        ultimos4: null,
      }),
    ).toBe('Pagado · Crédito · 6 cuotas · Autorización 555')
  })
})
