import { describe, expect, it } from 'vitest'
import {
  cuelloBotella,
  ETIQUETA_TRAMO,
  fmtHoras,
  parseKpiTiemposTramo,
} from './reporteTiemposTramo'

describe('reporteTiemposTramo', () => {
  it('parsea filas y detecta cuello de botella por mediana', () => {
    const filas = parseKpiTiemposTramo([
      { tramo: 'ingreso_tyc', orden: 1, n: 10, media_horas: 0.1, mediana_horas: 0.05 },
      { tramo: 'datos_forma_pago', orden: 3, n: 10, media_horas: 5, mediana_horas: 2.5 },
      { tramo: 'firma_matriculado', orden: 5, n: 0, media_horas: null, mediana_horas: null },
    ])
    expect(filas).toHaveLength(3)
    expect(cuelloBotella(filas)?.tramo).toBe('datos_forma_pago')
    expect(ETIQUETA_TRAMO.datos_forma_pago).toContain('Forma de pago')
  })

  it('formatea horas', () => {
    expect(fmtHoras(0.5)).toBe('30 min')
    expect(fmtHoras(3)).toBe('3 h')
    expect(fmtHoras(null)).toBe('—')
  })
})
