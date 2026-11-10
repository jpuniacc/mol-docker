import { describe, expect, it } from 'vitest'

import { cuentaWebpayAntesDeFirmar } from '@/utils/cuentaWebpayAntesDeFirmar'

const base = {
  medioMatricula: null as 'webpay' | 'pagare' | null,
  medioArancel: null as 'webpay' | 'pagare' | null,
  webpayMatriculaEstado: null as string | null,
  webpayArancelEstado: null as string | null,
  webpayMontoMatricula: null as number | null,
  webpayMontoArancel: null as number | null,
}

describe('cuentaWebpayAntesDeFirmar', () => {
  it('dos Webpay autorizados', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        webpayArancelEstado: 'autorizada',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: 1_000_000,
      }),
    ).toBe(true)
  })

  it('matrícula Webpay con arancel $0', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: 0,
      }),
    ).toBe(true)
  })

  it('matrícula $0 (reintegro) con arancel Webpay autorizado', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: null,
        medioArancel: 'webpay',
        webpayMontoMatricula: 0,
        webpayMontoArancel: 3_519_000,
        webpayArancelEstado: 'autorizada',
      }),
    ).toBe(true)
  })

  it('matrícula $0 sin arancel pagado aún no alcanza', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: null,
        medioArancel: 'webpay',
        webpayMontoMatricula: 0,
        webpayMontoArancel: 3_519_000,
        webpayArancelEstado: null,
      }),
    ).toBe(false)
  })

  it('matrícula $0 persistida como null (legacy) con arancel Webpay autorizado', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: null,
        medioArancel: 'webpay',
        webpayMontoMatricula: null,
        webpayMontoArancel: 3_519_000,
        webpayArancelEstado: 'autorizada',
      }),
    ).toBe(true)
  })

  it('solo pagaré no es cuenta Webpay', () => {
    expect(
      cuentaWebpayAntesDeFirmar({
        ...base,
        medioMatricula: 'pagare',
        medioArancel: 'pagare',
        webpayMontoMatricula: 200_000,
        webpayMontoArancel: 1_000_000,
      }),
    ).toBe(false)
  })
})
