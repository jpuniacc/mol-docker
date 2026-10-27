import { describe, expect, it } from 'vitest'
import {
  distribucionNps,
  esCalificacionNps,
  normalizarComentarioNps,
  promedioNps,
  tasaRespuestaNps,
} from './npsRematricula'

describe('esCalificacionNps', () => {
  it('acepta 1..7 enteros', () => {
    expect(esCalificacionNps(1)).toBe(true)
    expect(esCalificacionNps(7)).toBe(true)
    expect(esCalificacionNps(0)).toBe(false)
    expect(esCalificacionNps(8)).toBe(false)
    expect(esCalificacionNps(3.5)).toBe(false)
  })
})

describe('normalizarComentarioNps', () => {
  it('5 a 7 siempre null', () => {
    expect(normalizarComentarioNps(5, 'hola')).toBeNull()
    expect(normalizarComentarioNps(7, '  x  ')).toBeNull()
  })

  it('1-4 recorta y limita a 500', () => {
    expect(normalizarComentarioNps(2, '  mal  ')).toBe('mal')
    expect(normalizarComentarioNps(1, '   ')).toBeNull()
    expect(normalizarComentarioNps(4, 'a'.repeat(600))?.length).toBe(500)
  })
})

describe('agregados', () => {
  it('promedio y distribución', () => {
    expect(promedioNps([])).toBeNull()
    expect(promedioNps([5, 3])).toBe(4)
    expect(distribucionNps([1, 5, 5])).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2, 6: 0, 7: 0 })
  })

  it('tasa null si no hay finalizados', () => {
    expect(tasaRespuestaNps(0, 0)).toBeNull()
    expect(tasaRespuestaNps(2, 10)).toBe(0.2)
  })
})
