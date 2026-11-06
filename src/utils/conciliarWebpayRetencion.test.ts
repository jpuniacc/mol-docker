import { describe, expect, it } from 'vitest'
import {
  aplicarParcheRetencionASenales,
  parcheDesdeWebpayAutorizadas,
  rutaPasoPendienteRetencion,
} from './conciliarWebpayRetencion'

describe('parcheDesdeWebpayAutorizadas', () => {
  it('marca matrícula y pide limpiar arancel Webpay si el servidor no lo confirma', () => {
    expect(
      parcheDesdeWebpayAutorizadas({
        matriculaAutorizada: true,
        arancelAutorizado: false,
        firmaCompletadaServidor: false,
      }),
    ).toEqual({
      medioMatricula: 'webpay',
      webpayMatriculaEstado: 'autorizada',
      limpiarArancelWebpay: true,
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

describe('aplicarParcheRetencionASenales', () => {
  it('limpia arancel Webpay falso del borrador cuando el servidor no lo autoriza', () => {
    const limpio = aplicarParcheRetencionASenales(
      {
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: 'autorizada',
        pagoMatricula: null,
        firmaCompletada: false,
        arancelPorPagar: 1_000_000,
      },
      {
        matriculaAutorizada: true,
        arancelAutorizado: false,
        firmaCompletadaServidor: false,
      },
    )
    expect(limpio.medioArancel).toBeNull()
    expect(limpio.webpayArancelEstado).toBeNull()
    expect(limpio.webpayMatriculaEstado).toBe('autorizada')
    expect(rutaPasoPendienteRetencion(limpio)).toBe('matricula-alumno-forma-pago')
  })

  it('no borra medio pagaré con plan aunque arancel Webpay no esté en servidor', () => {
    const plan = { cuotas: 10 }
    const limpio = aplicarParcheRetencionASenales(
      {
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: null,
        pagoMatricula: plan,
        firmaCompletada: false,
        arancelPorPagar: 1_000_000,
      },
      {
        matriculaAutorizada: true,
        arancelAutorizado: false,
        firmaCompletadaServidor: false,
      },
    )
    expect(limpio.medioArancel).toBe('pagare')
    expect(limpio.pagoMatricula).toEqual(plan)
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
