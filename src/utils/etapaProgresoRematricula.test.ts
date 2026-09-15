import { describe, expect, it } from 'vitest'
import {
  etiquetaEtapaProgreso,
  resolverEtapaProgreso,
} from './etapaProgresoRematricula'

describe('resolverEtapaProgreso', () => {
  it('sin hitos → sin_ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('sin_ingreso')
  })

  it('solo ingreso → ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('ingreso')
  })

  it('tyc sin datos → tyc', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: true,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('tyc')
  })

  it('matriculado gana aunque falten flags intermedios', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: true,
      }),
    ).toBe('matriculado')
  })

  it('etiqueta legible', () => {
    expect(etiquetaEtapaProgreso('forma_pago')).toMatch(/pago/i)
  })
})
