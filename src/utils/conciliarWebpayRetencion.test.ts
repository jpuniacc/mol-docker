import { describe, expect, it } from 'vitest'
import {
  parcheDesdeWebpayAutorizadas,
  rutaPasoPendienteRetencion,
} from './conciliarWebpayRetencion'

describe('parcheDesdeWebpayAutorizadas', () => {
  it('marca matrícula autorizada sin tocar arancel si no hay tx', () => {
    expect(
      parcheDesdeWebpayAutorizadas({
        matriculaAutorizada: true,
        arancelAutorizado: false,
        firmaCompletadaServidor: false,
      }),
    ).toEqual({
      medioMatricula: 'webpay',
      webpayMatriculaEstado: 'autorizada',
      medioArancel: undefined,
      webpayArancelEstado: undefined,
      firmaCompletada: undefined,
    })
  })

  it('marca ambos conceptos y firma si el servidor confirma', () => {
    expect(
      parcheDesdeWebpayAutorizadas({
        matriculaAutorizada: true,
        arancelAutorizado: true,
        firmaCompletadaServidor: true,
      }),
    ).toEqual({
      medioMatricula: 'webpay',
      webpayMatriculaEstado: 'autorizada',
      medioArancel: 'webpay',
      webpayArancelEstado: 'autorizada',
      firmaCompletada: true,
    })
  })
})

describe('rutaPasoPendienteRetencion', () => {
  it('manda a forma de pago si falta arancel', () => {
    expect(
      rutaPasoPendienteRetencion({
        medioMatricula: 'webpay',
        medioArancel: null,
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: null,
        pagoMatricula: null,
        firmaCompletada: false,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe('matricula-alumno-forma-pago')
  })

  it('manda a firma si arancel resuelto', () => {
    expect(
      rutaPasoPendienteRetencion({
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: 'autorizada',
        pagoMatricula: null,
        firmaCompletada: false,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe('matricula-alumno-firma')
  })

  it('manda a resumen si ya firmó', () => {
    expect(
      rutaPasoPendienteRetencion({
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: 'autorizada',
        pagoMatricula: null,
        firmaCompletada: true,
        arancelPorPagar: 1_000_000,
      }),
    ).toBe('matricula-alumno-resumen')
  })
})
