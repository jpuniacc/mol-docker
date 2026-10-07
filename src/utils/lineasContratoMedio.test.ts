import { describe, expect, it } from 'vitest'
import { bloquesContrato } from '@/utils/lineasContratoMedio'

describe('bloquesContrato', () => {
  it('los dos Webpay no llevan cuotas, llevan el mandato y el arancel lleva el 5 %', () => {
    const bloques = bloquesContrato({
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      descuentoFormaPagoArancel: 133_350,
      montoWebpayMatricula: 200_000,
      montoWebpayArancel: 2_533_650,
    })
    expect(bloques.muestraCuotasMatricula).toBe(false)
    expect(bloques.muestraCuotasArancel).toBe(false)
    expect(bloques.muestraPagadoWebpayMatricula).toBe(true)
    expect(bloques.muestraPagadoWebpayArancel).toBe(true)
    expect(bloques.muestraMandatoPagare).toBe(true)
    expect(bloques.descuentoFormaPagoArancel).toBe(133_350)
  })

  it('un pagaré enciende sus cuotas y el mandato', () => {
    const bloques = bloquesContrato({
      medioMatricula: 'pagare',
      medioArancel: 'webpay',
      descuentoFormaPagoArancel: 132_000,
      montoWebpayMatricula: 0,
      montoWebpayArancel: 2_508_000,
    })
    expect(bloques.muestraCuotasMatricula).toBe(true)
    expect(bloques.muestraPagadoWebpayArancel).toBe(true)
    expect(bloques.muestraMandatoPagare).toBe(true)
  })
})
