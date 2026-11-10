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
      puedeContinuar({
        medioMatricula: 'pagare',
        medioArancel: 'pagare',
        matriculaAutorizada: false,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe(true)
    expect(
      puedeContinuar({
        medioMatricula: 'pagare',
        medioArancel: 'webpay',
        matriculaAutorizada: false,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe(false)
    expect(
      puedeContinuar({
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        matriculaAutorizada: true,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe(true)
  })

  it('con arancel $0 no exige medio de arancel', () => {
    expect(
      puedeContinuar({
        medioMatricula: 'pagare',
        medioArancel: null,
        matriculaAutorizada: false,
        arancelPorPagar: 0,
      }),
    ).toBe(true)
    expect(
      puedeContinuar({
        medioMatricula: 'webpay',
        medioArancel: null,
        matriculaAutorizada: true,
        arancelPorPagar: 0,
      }),
    ).toBe(true)
  })

  it('con matrícula $0 (reintegro) enciende arancel y no exige medio de matrícula', () => {
    expect(
      arancelHabilitado({
        medioMatricula: null,
        matriculaAutorizada: false,
        matriculaPorPagar: 0,
      }),
    ).toBe(true)
    expect(
      puedeContinuar({
        medioMatricula: null,
        medioArancel: 'pagare',
        matriculaAutorizada: false,
        matriculaPorPagar: 0,
        arancelPorPagar: 2_380_800,
      }),
    ).toBe(true)
  })
})
