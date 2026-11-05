import { describe, expect, it } from 'vitest'
import {
  arancelResueltoRetencion,
  copyProcesoIncompleto,
  pasoPendienteRetencion,
  procesoRematriculaIncompleto,
  type SenalesRetencionRematricula,
} from './procesoRematriculaIncompleto'

function base(parcial: Partial<SenalesRetencionRematricula> = {}): SenalesRetencionRematricula {
  return {
    medioMatricula: 'webpay',
    medioArancel: null,
    webpayMatriculaEstado: 'autorizada',
    webpayArancelEstado: null,
    pagoMatricula: null,
    firmaCompletada: false,
    arancelPorPagar: 1_000_000,
    periodoActivo: true,
    ...parcial,
  }
}

describe('procesoRematriculaIncompleto', () => {
  it('es incompleto con matrícula Webpay autorizada y sin firma', () => {
    expect(procesoRematriculaIncompleto(base())).toBe(true)
  })

  it('no es incompleto si no hay matrícula autorizada', () => {
    expect(
      procesoRematriculaIncompleto(
        base({ webpayMatriculaEstado: null, medioMatricula: 'webpay' }),
      ),
    ).toBe(false)
  })

  it('no es incompleto si ya firmó', () => {
    expect(procesoRematriculaIncompleto(base({ firmaCompletada: true }))).toBe(false)
  })

  it('no es incompleto si el periodo no está activo', () => {
    expect(procesoRematriculaIncompleto(base({ periodoActivo: false }))).toBe(false)
  })

  it('sigue incompleto aunque el arancel ya esté resuelto (falta firma)', () => {
    expect(
      procesoRematriculaIncompleto(
        base({
          medioArancel: 'webpay',
          webpayArancelEstado: 'autorizada',
        }),
      ),
    ).toBe(true)
  })
})

describe('arancelResueltoRetencion', () => {
  it('cubre con neto <= 0', () => {
    expect(arancelResueltoRetencion(base({ arancelPorPagar: 0 }))).toBe(true)
  })

  it('no cubre con monto desconocido (null)', () => {
    expect(arancelResueltoRetencion(base({ arancelPorPagar: null }))).toBe(false)
  })

  it('cubre con webpay arancel autorizada', () => {
    expect(
      arancelResueltoRetencion(
        base({
          medioArancel: 'webpay',
          webpayArancelEstado: 'autorizada',
          arancelPorPagar: 500_000,
        }),
      ),
    ).toBe(true)
  })

  it('cubre con pagaré y plan listo', () => {
    expect(
      arancelResueltoRetencion(
        base({
          medioArancel: 'pagare',
          pagoMatricula: { cuotas: 10 },
          arancelPorPagar: 500_000,
        }),
      ),
    ).toBe(true)
  })

  it('no cubre con medio vacío y neto > 0', () => {
    expect(arancelResueltoRetencion(base({ medioArancel: null, arancelPorPagar: 1 }))).toBe(
      false,
    )
  })
})

describe('pasoPendienteRetencion', () => {
  it('pide elegir arancel si falta medio', () => {
    expect(pasoPendienteRetencion(base()).tipo).toBe('elegir-arancel')
  })

  it('pide firma si arancel ya resuelto', () => {
    expect(
      pasoPendienteRetencion(
        base({
          medioArancel: 'webpay',
          webpayArancelEstado: 'autorizada',
        }),
      ).tipo,
    ).toBe('firma')
  })
})

describe('copyProcesoIncompleto', () => {
  it('menciona arancel y firma si falta arancel', () => {
    expect(copyProcesoIncompleto(base())).toContain('arancel')
  })

  it('solo menciona firma si arancel resuelto', () => {
    const texto = copyProcesoIncompleto(
      base({ medioArancel: 'webpay', webpayArancelEstado: 'autorizada' }),
    )
    expect(texto).toContain('firmar')
    expect(texto.toLowerCase()).not.toContain('arancel')
  })
})
