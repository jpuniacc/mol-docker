import { describe, expect, it } from 'vitest'

import { etiquetaFormaPago } from '@/utils/etiquetaFormaPago'

describe('etiquetaFormaPago', () => {
  it('muestra WebPay cuando matrícula y arancel se pagaron con tarjeta', () => {
    expect(
      etiquetaFormaPago({
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        formaPagoSeleccionada: null,
      }),
    ).toBe('WebPay')
  })

  it('muestra pagaré cuando los dos conceptos son pagaré', () => {
    expect(
      etiquetaFormaPago({
        medioMatricula: 'pagare',
        medioArancel: 'pagare',
        formaPagoSeleccionada: null,
      }),
    ).toBe('Pagaré')
  })

  it('junta los dos medios cuando son distintos', () => {
    expect(
      etiquetaFormaPago({
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        formaPagoSeleccionada: 'pagare',
      }),
    ).toBe('WebPay y pagaré')
  })

  it('conserva el medio único del flujo anterior', () => {
    expect(
      etiquetaFormaPago({
        medioMatricula: null,
        medioArancel: null,
        formaPagoSeleccionada: 'toku',
      }),
    ).toBe('TOKU')
  })

  it('sigue en no seleccionada si no hay medio', () => {
    expect(
      etiquetaFormaPago({
        medioMatricula: null,
        medioArancel: null,
        formaPagoSeleccionada: null,
      }),
    ).toBe('No seleccionada')
  })
})
