import { describe, expect, it } from 'vitest'
import {
  destinoDesdePaso,
  montoCrearSiguienteWebpay,
  motivoContinuarError,
} from './webpayRetornoContinuar'

describe('destinoDesdePaso', () => {
  it('mapea tipos de siguientePaso', () => {
    expect(destinoDesdePaso({ tipo: 'firma' })).toBe('firma')
    expect(destinoDesdePaso({ tipo: 'webpay', concepto: 'arancel' })).toBe('webpay')
    expect(destinoDesdePaso({ tipo: 'elegir-arancel' })).toBe('elegir-arancel')
    expect(destinoDesdePaso({ tipo: 'plan-pagare', concepto: 'matricula' })).toBe(
      'plan-pagare',
    )
    expect(destinoDesdePaso({ tipo: 'flujo-pagare' })).toBe('forma-pago')
  })
})

describe('motivoContinuarError', () => {
  it('clasifica motivos', () => {
    expect(motivoContinuarError('medio_null')).toBe('medio_null')
    expect(motivoContinuarError('monto_invalido')).toBe('monto_invalido')
    expect(motivoContinuarError('identidad')).toBe('identidad')
    expect(motivoContinuarError('crear_webpay')).toBe('crear_webpay')
    expect(motivoContinuarError('persistencia')).toBe('persistencia')
  })
})

describe('montoCrearSiguienteWebpay', () => {
  it('matrícula usa el monto guardado tal cual', () => {
    expect(
      montoCrearSiguienteWebpay({
        concepto: 'matricula',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: 4_163_250,
      }),
    ).toBe(200_000)
  })

  it('arancel aplica el 5 % sobre el saldo guardado (caso Guillermina)', () => {
    expect(
      montoCrearSiguienteWebpay({
        concepto: 'arancel',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: 4_163_250,
      }),
    ).toBe(3_955_087)
  })

  it('rechaza montos nulos o no enteros positivos', () => {
    expect(
      montoCrearSiguienteWebpay({
        concepto: 'arancel',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: null,
      }),
    ).toBeNull()
    expect(
      montoCrearSiguienteWebpay({
        concepto: 'matricula',
        webpayMontoMatricula: 0,
        webpayMontoArancel: 1,
      }),
    ).toBeNull()
  })
})
