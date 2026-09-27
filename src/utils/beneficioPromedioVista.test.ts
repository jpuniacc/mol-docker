import { describe, expect, it } from 'vitest'

import type { BeneficioExcelUiItem } from './carteraBeneficiosUi'
import {
  anioNotasRematricula,
  filasBeneficioConPromedio,
  textoAvisoPromedio,
  textoFuentePromedio,
} from './beneficioPromedioVista'

const CATALOGO = [
  {
    codigo_beneficio: '1795',
    flujo: 'MOL_DVU',
    renovable: 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR',
  },
  {
    codigo_beneficio: '1756',
    flujo: 'MOL_DVU',
    renovable: 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR',
  },
]

const ITEMS: BeneficioExcelUiItem[] = [
  {
    slot: 1,
    descripcion: 'Beca Talento Virtual',
    cod_beneficio: '1795',
    pct: 30,
    sinMapear: false,
    aplica: true,
    flujo: 'MOL_DVU',
  },
  {
    slot: 2,
    descripcion: 'Beneficio Apoyo UNIACC Renovable',
    cod_beneficio: '1756',
    pct: 10,
    sinMapear: false,
    aplica: true,
    flujo: 'MOL_DVU',
  },
]

describe('filasBeneficioConPromedio', () => {
  it('baja el % por Art. 13 y aplica Apoyo sobre el saldo', () => {
    const filas = filasBeneficioConPromedio({
      items: ITEMS,
      catalogo: CATALOGO,
      seleccionados: { 1: true, 2: true },
      arancelBruto: 4_990_000,
      promedio: 5.1,
    })
    const talento = filas.find((f) => f.codigo === '1795')
    const apoyo = filas.find((f) => f.codigo === '1756')
    expect(talento).toMatchObject({ resultado: 'BAJA', porcAplica: 22.5, monto: 1_122_750 })
    expect(apoyo).toMatchObject({ resultado: 'BAJA', porcAplica: 7.5, monto: 290_044 })
  })

  it('si se desmarca Talento, Apoyo usa el arancel completo', () => {
    const filas = filasBeneficioConPromedio({
      items: ITEMS,
      catalogo: CATALOGO,
      seleccionados: { 1: false, 2: true },
      arancelBruto: 4_990_000,
      promedio: 5.1,
    })
    const apoyo = filas.find((f) => f.codigo === '1756')
    expect(apoyo?.monto).toBe(Math.round(4_990_000 * 0.075))
    expect(filas.find((f) => f.codigo === '1795')?.monto).toBe(0)
  })
})

describe('textoAvisoPromedio', () => {
  it('describe la baja del tramo 5,1', () => {
    expect(textoAvisoPromedio(5.1)).toBe(
      'Tu promedio es 5,1. Las becas que exigen 5,5 bajan un 25 %.',
    )
  })
})

describe('textoFuentePromedio', () => {
  it('nombra el año anterior al periodo de rematrícula', () => {
    expect(anioNotasRematricula(2027)).toBe(2026)
    expect(textoFuentePromedio('anio', 2026)).toBe('Promedio del año 2026')
    expect(textoFuentePromedio('periodo', 2026)).toBe(
      'Promedio parcial del primer semestre 2026',
    )
  })
})
