import { describe, expect, it } from 'vitest'
import { armarReservaDescuentoUi } from '@/utils/reservaDescuentoUi'

describe('armarReservaDescuentoUi', () => {
  it('arma mensajes de reserva y matrícula a pagar', () => {
    const r = armarReservaDescuentoUi({
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
      reservaHasta: '2027-01-31',
      matriculaBruto: 200000,
    })
    expect(r).not.toBeNull()
    expect(r?.nombre).toBe('Matricula Anticipada Noviembre')
    expect(r?.montoFmt).toMatch(/50\.?000/)
    expect(r?.hasta.length).toBeGreaterThan(0)
    expect(r?.matriculaPagarFmt).toMatch(/150\.?000/)
    expect(r?.mensajeReserva).toContain('Tu descuento de')
    expect(r?.mensajeReserva).toContain('seguirá reservado hasta el')
    expect(r?.mensajeReserva).toContain(r!.hasta)
    expect(r?.mensajeMatriculaPagar).toBe(
      `El monto de matrícula a pagar es de ${r!.matriculaPagarFmt}.`,
    )
  })

  it('no deja matrícula a pagar bajo cero si el descuento supera el bruto', () => {
    const r = armarReservaDescuentoUi({
      nombre: 'Descuento',
      monto: 300000,
      reservaHasta: '2027-01-31',
      matriculaBruto: 200000,
    })
    expect(r?.matriculaPagarFmt).toMatch(/\$?0\b/)
  })

  it('retorna null si falta nombre, monto o matrícula inválida', () => {
    expect(
      armarReservaDescuentoUi({
        nombre: '',
        monto: 50000,
        reservaHasta: '2027-01-31',
        matriculaBruto: 200000,
      }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'X',
        monto: Number.NaN,
        reservaHasta: '2027-01-31',
        matriculaBruto: 200000,
      }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'X',
        monto: 50000,
        reservaHasta: '2027-01-31',
        matriculaBruto: Number.NaN,
      }),
    ).toBeNull()
  })

  it('retorna null si reserva_hasta no es usable', () => {
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: null,
        matriculaBruto: 200000,
      }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: '',
        matriculaBruto: 200000,
      }),
    ).toBeNull()
  })
})
