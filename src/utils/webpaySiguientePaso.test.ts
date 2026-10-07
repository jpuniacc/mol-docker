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
      }),
    ).toEqual({ tipo: 'elegir-arancel' })
  })

  it('matrícula Webpay sin autorizar sale a Webpay aunque el arancel no esté elegido', () => {
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: null,
      }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
  })
})
