import { describe, expect, it } from 'vitest'
import {
  bucketEsperaFormaPago,
  coincideFiltroEspera,
  etiquetaBucketEsperaFormaPago,
  etiquetaFiltroEsperaFormaPago,
} from './esperaFormaPagoKpi'

describe('bucketEsperaFormaPago', () => {
  it('null/undefined → resto', () => {
    expect(bucketEsperaFormaPago(null, undefined)).toBe('resto')
  })
  it('solo cae', () => {
    expect(bucketEsperaFormaPago(true, false)).toBe('cae')
  })
  it('solo ministerial', () => {
    expect(bucketEsperaFormaPago(false, true)).toBe('ministerial')
  })
  it('ambos', () => {
    expect(bucketEsperaFormaPago(true, true)).toBe('ambos')
  })
  it('ninguno → resto', () => {
    expect(bucketEsperaFormaPago(false, false)).toBe('resto')
  })
})

describe('coincideFiltroEspera', () => {
  it('todos acepta cualquier bucket', () => {
    for (const b of ['cae', 'ministerial', 'ambos', 'resto'] as const) {
      expect(coincideFiltroEspera(b, 'todos')).toBe(true)
    }
  })
  it('cae incluye ambos', () => {
    expect(coincideFiltroEspera('cae', 'cae')).toBe(true)
    expect(coincideFiltroEspera('ambos', 'cae')).toBe(true)
    expect(coincideFiltroEspera('ministerial', 'cae')).toBe(false)
    expect(coincideFiltroEspera('resto', 'cae')).toBe(false)
  })
  it('ministerial incluye ambos', () => {
    expect(coincideFiltroEspera('ministerial', 'ministerial')).toBe(true)
    expect(coincideFiltroEspera('ambos', 'ministerial')).toBe(true)
    expect(coincideFiltroEspera('cae', 'ministerial')).toBe(false)
  })
  it('ambos solo ambos', () => {
    expect(coincideFiltroEspera('ambos', 'ambos')).toBe(true)
    expect(coincideFiltroEspera('cae', 'ambos')).toBe(false)
  })
  it('resto solo resto', () => {
    expect(coincideFiltroEspera('resto', 'resto')).toBe(true)
    expect(coincideFiltroEspera('cae', 'resto')).toBe(false)
  })
})

describe('etiquetas', () => {
  it('filtro', () => {
    expect(etiquetaFiltroEsperaFormaPago('todos')).toBe('Todos')
    expect(etiquetaFiltroEsperaFormaPago('cae')).toBe('En espera CAE')
    expect(etiquetaFiltroEsperaFormaPago('ministerial')).toBe('En espera Ministerial')
    expect(etiquetaFiltroEsperaFormaPago('ambos')).toBe('Solo ambos')
    expect(etiquetaFiltroEsperaFormaPago('resto')).toBe('Resto (pueden avanzar)')
  })
  it('bucket (desglose embudo)', () => {
    expect(etiquetaBucketEsperaFormaPago('cae')).toBe('En espera CAE')
    expect(etiquetaBucketEsperaFormaPago('ministerial')).toBe('En espera Ministerial')
    expect(etiquetaBucketEsperaFormaPago('ambos')).toBe('En espera ambos')
    expect(etiquetaBucketEsperaFormaPago('resto')).toBe('Resto (pueden avanzar)')
  })
})
