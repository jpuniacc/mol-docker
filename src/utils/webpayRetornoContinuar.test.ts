import { describe, expect, it } from 'vitest'
import { destinoDesdePaso, motivoContinuarError } from './webpayRetornoContinuar'

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
  })
})
