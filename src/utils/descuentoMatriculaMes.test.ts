import { describe, expect, it } from 'vitest'

import {
  filaDescuentoMatriculaDelMes,
  type FilaDescuentoMatriculaMes,
} from '@/utils/descuentoMatriculaMes'

const FILAS: FilaDescuentoMatriculaMes[] = [
  {
    nombre: 'Matricula Anticipada Noviembre',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 50000,
    activo: true,
    vigencia_desde: '2026-11-01',
    vigencia_hasta: '2026-11-30',
  },
  {
    nombre: 'Matricula Anticipada Diciembre',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 25000,
    activo: true,
    vigencia_desde: '2026-12-01',
    vigencia_hasta: '2026-12-31',
  },
  {
    nombre: 'Descuento Matricula Reintegro',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 250000,
    activo: true,
    vigencia_desde: '2026-11-01',
    vigencia_hasta: '2027-03-31',
  },
]

describe('filaDescuentoMatriculaDelMes', () => {
  it('en noviembre toma los 50.000 y deja fuera el reintegro', () => {
    expect(
      filaDescuentoMatriculaDelMes({
        filas: FILAS,
        periodo: '2027-1',
        hoy: '2026-11-15',
        tieneCae: false,
        tieneBecaEstatal: false,
      }),
    ).toEqual({ nombre: 'Matricula Anticipada Noviembre', monto: 50000 })
  })

  it('en diciembre toma los 25.000', () => {
    expect(
      filaDescuentoMatriculaDelMes({
        filas: FILAS,
        periodo: '2027-1',
        hoy: '2026-12-01',
        tieneCae: false,
        tieneBecaEstatal: false,
      })?.monto,
    ).toBe(25000)
  })

  it('fuera de esos meses no hay descuento', () => {
    expect(
      filaDescuentoMatriculaDelMes({
        filas: FILAS,
        periodo: '2027-1',
        hoy: '2026-09-30',
        tieneCae: false,
        tieneBecaEstatal: false,
      }),
    ).toBeNull()
  })

  it('con CAE o beca estatal no descuenta', () => {
    const base = {
      filas: FILAS,
      periodo: '2027-1',
      hoy: '2026-11-15',
      tieneCae: false,
      tieneBecaEstatal: false,
    }
    expect(filaDescuentoMatriculaDelMes({ ...base, tieneCae: true })).toBeNull()
    expect(filaDescuentoMatriculaDelMes({ ...base, tieneBecaEstatal: true })).toBeNull()
  })
})
