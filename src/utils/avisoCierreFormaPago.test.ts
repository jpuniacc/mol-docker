import { describe, expect, it } from 'vitest'
import { copyAvisoCierreFormaPago } from './avisoCierreFormaPago'

function base(
  overrides: Partial<Parameters<typeof copyAvisoCierreFormaPago>[0]> = {},
): Parameters<typeof copyAvisoCierreFormaPago>[0] {
  return {
    medioMatricula: null,
    medioArancel: null,
    webpayMatriculaEstado: null,
    webpayArancelEstado: null,
    pagoMatricula: null,
    arancelPorPagar: 1_000_000,
    firmaCompletada: false,
    ...overrides,
  }
}

describe('copyAvisoCierreFormaPago', () => {
  it('no avisa si firma completa', () => {
    expect(
      copyAvisoCierreFormaPago(
        base({
          medioMatricula: 'webpay',
          webpayMatriculaEstado: 'autorizada',
          firmaCompletada: true,
        }),
      ),
    ).toBeNull()
  })

  it('no avisa si matrícula Webpay OK y arancel neto ≤ 0', () => {
    expect(
      copyAvisoCierreFormaPago(
        base({
          medioMatricula: 'webpay',
          webpayMatriculaEstado: 'autorizada',
          arancelPorPagar: 0,
        }),
      ),
    ).toBeNull()
  })

  it('caso Finanzas: matrícula pagada y falta arancel', () => {
    const copy = copyAvisoCierreFormaPago(
      base({
        medioMatricula: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        medioArancel: null,
        arancelPorPagar: 4_000_000,
      }),
    )
    expect(copy?.tipo).toBe('arancel')
    expect(copy?.cuerpo).toContain('forma de pago del arancel')
    expect(copy?.cuerpo).toContain('firmar tu contrato')
    expect(copy?.aviso).toContain('¡No te preocupes!')
    expect(copy?.aviso).toContain('No necesitas volver a pagarlo')
  })

  it('caso ambos: falta matrícula y arancel', () => {
    const copy = copyAvisoCierreFormaPago(base())
    expect(copy?.tipo).toBe('ambos')
    expect(copy?.cuerpo).toContain('matrícula y del arancel')
  })

  it('avisa arancel si eligió webpay arancel sin autorizar', () => {
    const copy = copyAvisoCierreFormaPago(
      base({
        medioMatricula: 'webpay',
        webpayMatriculaEstado: 'autorizada',
        medioArancel: 'webpay',
        webpayArancelEstado: null,
      }),
    )
    expect(copy?.tipo).toBe('arancel')
  })
})
