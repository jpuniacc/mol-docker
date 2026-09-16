import { describe, expect, it } from 'vitest'

import {
  flagsConsolidado,
  itemsBeneficioDesdeCartera,
  type CarteraBeneficioRow,
} from './carteraBeneficiosUi'

const VANESSA: CarteraBeneficioRow = {
  periodo: '2027-01',
  rut_norm: '129460857',
  codcli_excel: '20152PSIC1SR039',
  beca_1: 'Beneficio Apoyo UNIACC Renovable',
  pct_1: 10,
  beca_2: null,
  pct_2: null,
  consolidado: null,
  cod_beneficio_1: '1756',
  cod_beneficio_2: null,
}

describe('itemsBeneficioDesdeCartera', () => {
  it('12946085 solo Apoyo 1756; no inventa 1791', () => {
    const items = itemsBeneficioDesdeCartera(VANESSA)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      slot: 1,
      descripcion: 'Beneficio Apoyo UNIACC Renovable',
      cod_beneficio: '1756',
      pct: 10,
      sinMapear: false,
    })
    expect(items.some((i) => i.cod_beneficio === '1791')).toBe(false)
  })

  it('row null → []', () => {
    expect(itemsBeneficioDesdeCartera(null)).toEqual([])
  })

  it('omite slots Sin beca o vacíos', () => {
    const items = itemsBeneficioDesdeCartera({
      ...VANESSA,
      beca_1: 'Sin beca',
      pct_1: null,
      cod_beneficio_1: null,
      beca_2: '  ',
      pct_2: 5,
      cod_beneficio_2: '9999',
    })
    expect(items).toEqual([])
  })

  it('sinMapear cuando hay texto pero sin cod_beneficio', () => {
    const items = itemsBeneficioDesdeCartera({
      ...VANESSA,
      cod_beneficio_1: null,
    })
    expect(items).toHaveLength(1)
    expect(items[0].sinMapear).toBe(true)
    expect(items[0].cod_beneficio).toBeNull()
  })

  it('incluye beca_1 y beca_2 cuando ambas tienen texto', () => {
    const items = itemsBeneficioDesdeCartera({
      ...VANESSA,
      beca_2: 'DESCUENTO ANTICIPACION MATRICULA NUEVO',
      pct_2: 15,
      cod_beneficio_2: '1791',
    })
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({ slot: 2, cod_beneficio: '1791', pct: 15 })
  })
})

describe('flagsConsolidado', () => {
  it('null → todos false', () => {
    expect(flagsConsolidado(null)).toEqual({ cae: false, ministerial: false, subdere: false })
  })

  it('detecta CAE, ministerial y SUBDERE en el texto', () => {
    expect(flagsConsolidado('CAE')).toEqual({ cae: true, ministerial: false, subdere: false })
    expect(flagsConsolidado('BECA MINISTERIAL')).toEqual({
      cae: false,
      ministerial: true,
      subdere: false,
    })
    expect(flagsConsolidado('SUBDERE')).toEqual({ cae: false, ministerial: false, subdere: true })
  })
})
