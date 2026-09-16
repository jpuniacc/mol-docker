import { describe, expect, it } from 'vitest'

import {
  etiquetaMesPrimeraCuota,
  fechaInicioPagarePeriodo,
  mesPrimeraCuotaPeriodo,
  proximaFechaDiaVencimiento,
} from '@/utils/pagareFechaInicio'

describe('mesPrimeraCuotaPeriodo', () => {
  it('semestre 1 → marzo', () => {
    expect(mesPrimeraCuotaPeriodo(1)).toBe(3)
  })
  it('semestre 2 → agosto', () => {
    expect(mesPrimeraCuotaPeriodo(2)).toBe(8)
  })
  it('otro → null', () => {
    expect(mesPrimeraCuotaPeriodo(null)).toBeNull()
    expect(mesPrimeraCuotaPeriodo(3)).toBeNull()
  })
})

describe('fechaInicioPagarePeriodo', () => {
  it('2027-01 con día 5 → 2027-03-05', () => {
    const r = fechaInicioPagarePeriodo({
      dia: 5,
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      hoy: new Date(2026, 8, 16),
    })
    expect(r).toBe('2027-03-05')
  })

  it('2027-01 con día 15 → 2027-03-15', () => {
    const r = fechaInicioPagarePeriodo({
      dia: 15,
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      hoy: new Date(2026, 8, 16),
    })
    expect(r).toBe('2027-03-15')
  })

  it('semestre 2 → agosto del año del periodo', () => {
    const r = fechaInicioPagarePeriodo({
      dia: 5,
      anioPeriodo: 2026,
      semestrePeriodo: 2,
      hoy: new Date(2026, 2, 1),
    })
    expect(r).toBe('2026-08-05')
  })

  it('si marzo del periodo ya pasó, usa mes siguiente a hoy', () => {
    const r = fechaInicioPagarePeriodo({
      dia: 5,
      anioPeriodo: 2026,
      semestrePeriodo: 1,
      hoy: new Date(2026, 3, 10),
    })
    expect(r).toBe(proximaFechaDiaVencimiento(5, new Date(2026, 3, 10)))
    expect(r).toBe('2026-05-05')
  })
})

describe('etiquetaMesPrimeraCuota', () => {
  it('2027-01 → marzo 2027', () => {
    expect(etiquetaMesPrimeraCuota(2027, 1)).toBe('marzo 2027')
  })
})
