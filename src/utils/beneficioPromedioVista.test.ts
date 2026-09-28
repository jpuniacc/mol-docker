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

  it('recorta la última interna cuando juntas pasan el 70 % del arancel', () => {
    const items = ITEMS.map((item) => ({ ...item, pct: 50 }))
    const filas = filasBeneficioConPromedio({
      items,
      catalogo: CATALOGO,
      seleccionados: { 1: true, 2: true },
      arancelBruto: 1_000_000,
      promedio: 6.1,
    })
    const talento = filas.find((f) => f.codigo === '1795')
    const apoyo = filas.find((f) => f.codigo === '1756')
    expect(talento).toMatchObject({ monto: 500_000, recortadoTope: false })
    expect(apoyo).toMatchObject({ monto: 200_000, recortadoTope: true })
  })

  it('aplica la beca estatal sobre el arancel antes que la interna', () => {
    const filas = filasBeneficioConPromedio({
      items: [
        {
          slot: 1,
          descripcion: 'Beca ministerial',
          cod_beneficio: 'BJGM',
          pct: 50,
          sinMapear: false,
          aplica: true,
          flujo: 'ESTATAL',
        },
        ITEMS[0]!,
      ],
      catalogo: [
        ...CATALOGO,
        { codigo_beneficio: 'BJGM', flujo: 'ESTATAL', renovable: 'BECA ESTATAL' },
      ],
      seleccionados: { 1: true, 2: true },
      arancelBruto: 4_000_000,
      promedio: 6,
    })
    expect(filas.find((f) => f.codigo === 'BJGM')).toMatchObject({ monto: 2_000_000 })
    expect(filas.find((f) => f.codigo === '1795')).toMatchObject({ monto: 600_000 })
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
