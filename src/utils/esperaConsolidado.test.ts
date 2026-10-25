import { describe, expect, it } from 'vitest'
import { esperaDesdeConsolidado, requiereVerificacionCae } from './esperaConsolidado'

describe('esperaDesdeConsolidado', () => {
  it('CAE solo espera CAE', () => {
    expect(esperaDesdeConsolidado('CAE')).toEqual({
      cae: true,
      ministerial: false,
      textoMinisterial: null,
    })
  })

  it('BECA MINISTERIAL espera ministerial y conserva el texto', () => {
    expect(esperaDesdeConsolidado('BECA MINISTERIAL')).toEqual({
      cae: false,
      ministerial: true,
      textoMinisterial: 'BECA MINISTERIAL',
    })
  })

  it('CAE/BECA MINISTERIAL espera las dos', () => {
    expect(esperaDesdeConsolidado('cae/beca ministerial')).toEqual({
      cae: true,
      ministerial: true,
      textoMinisterial: 'cae/beca ministerial',
    })
  })

  it('SUBDERE no entra', () => {
    expect(esperaDesdeConsolidado('SUBDERE')).toEqual({
      cae: false,
      ministerial: false,
      textoMinisterial: null,
    })
  })

  it('vacío o ausente sigue sin espera', () => {
    expect(esperaDesdeConsolidado(null)).toEqual({
      cae: false,
      ministerial: false,
      textoMinisterial: null,
    })
    expect(esperaDesdeConsolidado('')).toEqual({
      cae: false,
      ministerial: false,
      textoMinisterial: null,
    })
    expect(esperaDesdeConsolidado(undefined)).toEqual({
      cae: false,
      ministerial: false,
      textoMinisterial: null,
    })
  })
})

describe('requiereVerificacionCae', () => {
  it('el consolidado vacío no toma el CAE viejo del plan', () => {
    expect(requiereVerificacionCae(null)).toBe(false)
    expect(requiereVerificacionCae('')).toBe(false)
  })

  it('el consolidado CAE entra', () => {
    expect(requiereVerificacionCae('CAE')).toBe(true)
  })

  it('beca ministerial sin CAE no entra', () => {
    expect(requiereVerificacionCae('BECA MINISTERIAL')).toBe(false)
  })
})
