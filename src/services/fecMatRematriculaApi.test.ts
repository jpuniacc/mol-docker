import { describe, expect, it } from 'vitest'

import { etiquetaFecMat, mapaFecMatPorCodcli } from './fecMatRematriculaApi'

describe('etiquetaFecMat', () => {
  it('devuelve guión sin fecha', () => {
    expect(etiquetaFecMat(null)).toBe('—')
    expect(etiquetaFecMat({ fecMat: null, horaMat: null })).toBe('—')
  })

  it('muestra solo fecha si no hay hora útil', () => {
    expect(etiquetaFecMat({ fecMat: '02/11/2026', horaMat: null })).toBe('02/11/2026')
    expect(etiquetaFecMat({ fecMat: '02/11/2026', horaMat: '00:00:00' })).toBe('02/11/2026')
  })

  it('agrega hora HH:mm', () => {
    expect(etiquetaFecMat({ fecMat: '02/11/2026', horaMat: '16:28:48' })).toBe(
      '02/11/2026 16:28',
    )
  })
})

describe('mapaFecMatPorCodcli', () => {
  it('indexa por codcli', () => {
    expect(
      mapaFecMatPorCodcli([
        { codcli: '20261PSIC1SR017', rut: '18539769', fecMat: '02/11/2026', horaMat: '16:28:48' },
      ]),
    ).toEqual({ '20261PSIC1SR017': '02/11/2026 16:28' })
  })
})
