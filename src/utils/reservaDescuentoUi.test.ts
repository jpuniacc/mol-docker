import { describe, expect, it } from 'vitest'
import { armarReservaDescuentoUi } from '@/utils/reservaDescuentoUi'

describe('armarReservaDescuentoUi', () => {
  it('arma las tres líneas con monto como descuento', () => {
    const r = armarReservaDescuentoUi({
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
      reservaHasta: '2027-01-31',
    })
    expect(r).not.toBeNull()
    expect(r?.nombre).toBe('Matricula Anticipada Noviembre')
    expect(r?.montoFmt).toMatch(/50\.?000/)
    expect(r?.hasta).not.toBe('—')
    expect(r?.hasta.length).toBeGreaterThan(0)
  })

  it('retorna null si falta nombre o monto inválido', () => {
    expect(
      armarReservaDescuentoUi({ nombre: '', monto: 50000, reservaHasta: '2027-01-31' }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'X',
        monto: Number.NaN,
        reservaHasta: '2027-01-31',
      }),
    ).toBeNull()
  })

  it('retorna null si reserva_hasta no es usable', () => {
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: null,
      }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: '',
      }),
    ).toBeNull()
  })
})
