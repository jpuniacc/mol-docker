import { describe, expect, it } from 'vitest'
import { arancelHabilitado, puedeContinuar } from '@/utils/selectorMedioPago'

describe('selectorMedioPago', () => {
  it('el arancel parte apagado', () => {
    expect(arancelHabilitado({ medioMatricula: null, matriculaAutorizada: false })).toBe(false)
  })

  it('pagaré en matrícula enciende el arancel', () => {
    expect(arancelHabilitado({ medioMatricula: 'pagare', matriculaAutorizada: false })).toBe(true)
  })

  it('Webpay en matrícula deja el arancel apagado hasta que vuelva autorizado', () => {
    expect(arancelHabilitado({ medioMatricula: 'webpay', matriculaAutorizada: false })).toBe(false)
    expect(arancelHabilitado({ medioMatricula: 'webpay', matriculaAutorizada: true })).toBe(true)
  })

  it('Continuar solo arma el plan de pagaré', () => {
    expect(
      puedeContinuar({ medioMatricula: 'pagare', medioArancel: 'pagare', matriculaAutorizada: false }),
    ).toBe(true)
    expect(
      puedeContinuar({ medioMatricula: 'pagare', medioArancel: 'webpay', matriculaAutorizada: false }),
    ).toBe(false)
    expect(
      puedeContinuar({ medioMatricula: 'webpay', medioArancel: 'pagare', matriculaAutorizada: true }),
    ).toBe(true)
  })
})
