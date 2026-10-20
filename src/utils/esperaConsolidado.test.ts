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
  it('el plan con CAE entra aunque el consolidado venga vacío', () => {
    expect(requiereVerificacionCae(null, { alumno_cae: 'Si' })).toBe(true)
    expect(requiereVerificacionCae('', { alumno_cae: 'Sí' })).toBe(true)
  })

  it('el consolidado CAE entra aunque el plan diga que no', () => {
    expect(requiereVerificacionCae('CAE', { alumno_cae: 'No' })).toBe(true)
  })

  it('sin consolidado CAE y sin plan CAE no entra', () => {
    expect(requiereVerificacionCae('BECA MINISTERIAL', { alumno_cae: 'No' })).toBe(false)
    expect(requiereVerificacionCae(null, null)).toBe(false)
  })
})
