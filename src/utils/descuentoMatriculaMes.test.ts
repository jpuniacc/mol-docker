import { describe, expect, it } from 'vitest'

import {
  descuentoMatriculaAplicado,
  descuentoMatriculaCambio,
  descuentoMatriculaParaPago,
  filaDescuentoMatriculaDelMes,
  msHastaProximaMedianocheChile,
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

const FILA_NOVIEMBRE: FilaDescuentoMatriculaMes = {
  ...FILAS[0]!,
  id: 2,
  reserva_hasta: '2027-03-15',
}

/** Catálogo prod 2027-1 (ids reales del mantenedor). */
const FILAS_PROD_2027_1: FilaDescuentoMatriculaMes[] = [
  {
    id: 2,
    nombre: 'Matricula Anticipada Noviembre',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 50000,
    activo: true,
    vigencia_desde: '2026-11-01',
    vigencia_hasta: '2026-11-30',
    reserva_hasta: '2027-01-31',
  },
  {
    id: 1,
    nombre: 'Matricula Anticipada Diciembre',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 25000,
    activo: true,
    vigencia_desde: '2026-12-01',
    vigencia_hasta: '2026-12-31',
    reserva_hasta: '2027-01-31',
  },
  {
    id: 6,
    nombre: 'Matricula Anticipada Enero',
    periodo: '2027-1',
    aplicable_a: 'MATRICULA',
    monto_descuento: 25000,
    activo: true,
    vigencia_desde: '2027-01-01',
    vigencia_hasta: '2027-01-10',
    reserva_hasta: '2027-01-31',
  },
]

describe('descuentoMatriculaParaPago', () => {
  it('rollover sin reserva: mismo alumno nov $50.000 luego dic $25.000', () => {
    const base = {
      filas: FILAS_PROD_2027_1,
      periodo: '2027-1',
      tieneCae: false,
      tieneBecaEstatal: false,
      reserva: null,
    }
    expect(descuentoMatriculaParaPago({ ...base, hoy: '2026-11-20' })).toEqual({
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
    })
    expect(descuentoMatriculaParaPago({ ...base, hoy: '2026-12-01' })).toEqual({
      nombre: 'Matricula Anticipada Diciembre',
      monto: 25000,
    })
  })

  it('con reserva CAE no hace rollover al pasar el mes', () => {
    const reserva = {
      descuentoId: 2,
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
    }
    expect(
      descuentoMatriculaParaPago({
        filas: FILAS_PROD_2027_1,
        periodo: '2027-1',
        hoy: '2026-12-15',
        tieneCae: true,
        tieneBecaEstatal: false,
        reserva,
      }),
    ).toEqual({ nombre: 'Matricula Anticipada Noviembre', monto: 50000 })
  })

  it('usa el monto reservado en enero aunque tenga CAE', () => {
    expect(
      descuentoMatriculaParaPago({
        filas: [FILA_NOVIEMBRE],
        periodo: '2027-1',
        hoy: '2027-01-10',
        tieneCae: true,
        tieneBecaEstatal: false,
        reserva: { descuentoId: 2, nombre: 'Matricula Anticipada Noviembre', monto: 50000 },
      }),
    ).toEqual({ nombre: 'Matricula Anticipada Noviembre', monto: 50000 })
  })

  it('vence el día después de reservable hasta', () => {
    expect(
      descuentoMatriculaParaPago({
        filas: [FILA_NOVIEMBRE],
        periodo: '2027-1',
        hoy: '2027-03-16',
        tieneCae: true,
        tieneBecaEstatal: false,
        reserva: { descuentoId: 2, nombre: 'Matricula Anticipada Noviembre', monto: 50000 },
      }),
    ).toBeNull()
  })

  it('sin reserva y con CAE no descuenta en el mes', () => {
    expect(
      descuentoMatriculaParaPago({
        filas: [FILA_NOVIEMBRE],
        periodo: '2027-1',
        hoy: '2026-11-15',
        tieneCae: true,
        tieneBecaEstatal: false,
        reserva: null,
      }),
    ).toBeNull()
  })
})

describe('descuentoMatriculaCambio', () => {
  it('detecta rollover nov→dic sin reserva', () => {
    const base = {
      filas: FILAS_PROD_2027_1,
      periodo: '2027-1',
      tieneCae: false,
      tieneBecaEstatal: false,
      reserva: null,
    }
    const nov = descuentoMatriculaParaPago({ ...base, hoy: '2026-11-30' })
    const dic = descuentoMatriculaParaPago({ ...base, hoy: '2026-12-01' })
    expect(descuentoMatriculaCambio(nov, dic)).toBe(true)
  })

  it('con reserva CAE nov→dic no reporta cambio', () => {
    const reserva = {
      descuentoId: 2,
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
    }
    const base = {
      filas: FILAS_PROD_2027_1,
      periodo: '2027-1',
      tieneCae: true,
      tieneBecaEstatal: false,
      reserva,
    }
    const nov = descuentoMatriculaParaPago({ ...base, hoy: '2026-11-30' })
    const dic = descuentoMatriculaParaPago({ ...base, hoy: '2026-12-01' })
    expect(descuentoMatriculaCambio(nov, dic)).toBe(false)
  })
})

describe('msHastaProximaMedianocheChile', () => {
  it('devuelve al menos 1s y menos de 36h', () => {
    const ms = msHastaProximaMedianocheChile(new Date('2026-11-30T15:00:00-03:00'))
    expect(ms).toBeGreaterThanOrEqual(1000)
    expect(ms).toBeLessThan(36 * 60 * 60 * 1000)
  })
})

describe('descuentoMatriculaAplicado', () => {
  it('devuelve la fila del mes elegida, no el reintegro', () => {
    const filas = FILAS.map((f, i) => ({ ...f, id: i + 10 }))
    const r = descuentoMatriculaAplicado({
      filas,
      periodo: '2027-1',
      hoy: '2026-11-15',
      tieneCae: false,
      tieneBecaEstatal: false,
      reserva: null,
    })
    expect(r?.fila.id).toBe(10)
    expect(r?.descuento).toEqual({ nombre: 'Matricula Anticipada Noviembre', monto: 50000 })
  })

  it('con reserva vigente devuelve la fila reservada', () => {
    const r = descuentoMatriculaAplicado({
      filas: [FILA_NOVIEMBRE],
      periodo: '2027-1',
      hoy: '2027-01-10',
      tieneCae: true,
      tieneBecaEstatal: false,
      reserva: { descuentoId: 2, nombre: 'Matricula Anticipada Noviembre', monto: 50000 },
    })
    expect(r?.fila.id).toBe(2)
  })
})
