import { describe, expect, it } from 'vitest'

import type { MnpMvBeneficioPeriodoRow, PlanPagosMvRow } from '@/types/supabase'

import {
  clasificarBeneficiosPlan,
  detectarBecasEstatales,
  tieneBecaEstatal,
} from './beneficioPerfil'

function planConCodigos(codigos: string[]): PlanPagosMvRow {
  return {
    beneficios_detalle: codigos.map((cod_beneficio) => ({
      cod_beneficio,
      descripcion: `desc ${cod_beneficio}`,
      monto: null,
      porc_apr: null,
      aplicable: null,
      estado: null,
    })),
  } as PlanPagosMvRow
}

function catalogo(
  rows: Array<Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'beneficio' | 'flujo'>>,
): MnpMvBeneficioPeriodoRow[] {
  return rows as MnpMvBeneficioPeriodoRow[]
}

const cat = catalogo([
  { codigo_beneficio: '9', beneficio: 'Juan Gomez Millas', flujo: 'ESTATAL' },
  { codigo_beneficio: '1744', beneficio: 'Talento', flujo: 'MOL_DVU' },
  { codigo_beneficio: '1552', beneficio: 'CAJA LOS ANDES', flujo: 'CONVENIO' },
  { codigo_beneficio: '1657', beneficio: 'Complementario', flujo: 'NO_RENOVABLE' },
])

describe('detectarBecasEstatales', () => {
  it('detecta estatal solo si está en el plan y en el catálogo', () => {
    expect(detectarBecasEstatales(planConCodigos(['9', '1744']), cat)).toEqual([
      { codigoBeneficio: '9', beneficio: 'Juan Gomez Millas' },
    ])
  })

  it('no detecta si el plan no tiene código estatal', () => {
    expect(detectarBecasEstatales(planConCodigos(['1744', '1552']), cat)).toEqual([])
    expect(tieneBecaEstatal(planConCodigos(['1744']), cat)).toBe(false)
  })

  it('tieneBecaEstatal es true con match', () => {
    expect(tieneBecaEstatal(planConCodigos(['9']), cat)).toBe(true)
  })
})

describe('clasificarBeneficiosPlan', () => {
  it('etiqueta interna, estatal y no renovable', () => {
    const filas = clasificarBeneficiosPlan(planConCodigos(['1744', '9', '1657', '9999']), cat)
    expect(filas.map((f) => f.etiqueta)).toEqual([
      'Interna',
      'Estatal',
      'No renovable',
      'Sin catálogo',
    ])
  })
})
