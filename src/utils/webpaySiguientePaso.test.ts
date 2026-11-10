import { describe, expect, it } from 'vitest'

import { siguientePaso } from '@/utils/webpaySiguientePaso'

const base = {
  matriculaAutorizada: false,
  arancelAutorizado: false,
  planListo: false,
}

describe('siguientePaso', () => {
  it('los dos pagaré usan el flujo actual', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'pagare', medioArancel: 'pagare' }).tipo,
    ).toBe('flujo-pagare')
  })

  it('matrícula Webpay va a Transbank antes del plan de arancel', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'webpay', medioArancel: 'pagare' }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        matriculaAutorizada: true,
      }),
    ).toEqual({ tipo: 'plan-pagare', concepto: 'arancel' })
  })

  it('arancel Webpay va a Transbank antes del plan de matrícula', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'pagare', medioArancel: 'webpay' }),
    ).toEqual({ tipo: 'webpay', concepto: 'arancel' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'pagare',
        medioArancel: 'webpay',
        arancelAutorizado: true,
      }),
    ).toEqual({ tipo: 'plan-pagare', concepto: 'matricula' })
  })

  it('los dos Webpay cobran matrícula y solo después el arancel', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'webpay', medioArancel: 'webpay' }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        matriculaAutorizada: true,
      }),
    ).toEqual({ tipo: 'webpay', concepto: 'arancel' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        matriculaAutorizada: true,
        arancelAutorizado: true,
      }),
    ).toEqual({ tipo: 'firma' })
  })

  it('después del plan de pagaré pasa a la firma', () => {
    expect(
      siguientePaso({
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        matriculaAutorizada: true,
        arancelAutorizado: false,
        planListo: true,
      }),
    ).toEqual({ tipo: 'firma' })
  })

  it('matrícula Webpay sin arancel elegido vuelve al diálogo', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: null,
        matriculaAutorizada: true,
        arancelPorPagar: 1_000_000,
      }),
    ).toEqual({ tipo: 'elegir-arancel' })
  })

  it('matrícula Webpay sin autorizar sale a Webpay aunque el arancel no esté elegido', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: null,
        arancelPorPagar: 1_000_000,
      }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
  })

  it('arancel $0 con matrícula pagaré arma solo el plan de matrícula', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'pagare',
        medioArancel: null,
        arancelPorPagar: 0,
      }),
    ).toEqual({ tipo: 'flujo-pagare' })
  })

  it('arancel $0 con matrícula Webpay autorizada va a firma', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: null,
        matriculaAutorizada: true,
        arancelPorPagar: 0,
      }),
    ).toEqual({ tipo: 'firma' })
  })

  it('matrícula $0 (reintegro) con arancel pagaré arma solo el plan de arancel', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: null,
        medioArancel: 'pagare',
        matriculaPorPagar: 0,
        arancelPorPagar: 2_380_800,
      }),
    ).toEqual({ tipo: 'plan-pagare', concepto: 'arancel' })
  })

  it('matrícula $0 y arancel $0 van a firma', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: null,
        medioArancel: null,
        matriculaPorPagar: 0,
        arancelPorPagar: 0,
      }),
    ).toEqual({ tipo: 'firma' })
  })

  it('matrícula $0 con arancel Webpay autorizado va a firma', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: null,
        medioArancel: 'webpay',
        matriculaPorPagar: 0,
        arancelPorPagar: 3_343_050,
        arancelAutorizado: true,
      }),
    ).toEqual({ tipo: 'firma' })
  })
})
