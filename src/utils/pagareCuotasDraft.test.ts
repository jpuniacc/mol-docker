import { describe, expect, it } from 'vitest'

import {
  addMonthsSameDay,
  buildPagareCuotasDraft,
  folioCuota,
  incrementPeek,
  splitMontoEnCuotas,
} from '@/utils/pagareCuotasDraft'

describe('incrementPeek / folioCuota', () => {
  it('deriva el segundo folio localmente', () => {
    expect(incrementPeek('90121395927', 1)).toBe('90121395928')
  })

  it('concatena sufijo de cuota estilo U+', () => {
    expect(folioCuota('90121395914', 1)).toBe('9012139591401')
    expect(folioCuota('90121395914', 10)).toBe('9012139591410')
  })
})

describe('splitMontoEnCuotas', () => {
  it('ajusta el residuo en la última cuota', () => {
    const parts = splitMontoEnCuotas(250000, 10)
    expect(parts).toHaveLength(10)
    expect(parts.slice(0, 9).every((x) => x === 25000)).toBe(true)
    expect(parts[9]).toBe(25000)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(250000)
  })

  it('reparte residuo cuando no divide exacto', () => {
    const parts = splitMontoEnCuotas(100, 3)
    expect(parts).toEqual([33, 33, 34])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('addMonthsSameDay', () => {
  it('avanza de mes conservando el día', () => {
    expect(addMonthsSameDay('2026-09-05', 0)).toBe('2026-09-05')
    expect(addMonthsSameDay('2026-09-05', 1)).toBe('2026-10-05')
    expect(addMonthsSameDay('2026-12-05', 1)).toBe('2027-01-05')
  })
})

describe('buildPagareCuotasDraft', () => {
  const base = {
    fechaInicio: '2026-09-05',
    dia: 5 as const,
    montoMat: 200000,
    montoAra: 3640000,
    corrpagMat: '90121395927',
    corrpagAra: '90121395928',
    hoy: '2026-08-19',
  }

  it('arma 20 filas matrícula + arancel y reinicia TOTAL por ítem', () => {
    const r = buildPagareCuotasDraft(base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(20)
    const mat = r.rows.filter((x) => x.items === 'MATRICULA')
    const ara = r.rows.filter((x) => x.items === 'ARANCEL')
    expect(mat).toHaveLength(10)
    expect(ara).toHaveLength(10)
    expect(mat.every((x) => x.totalCuotas === 10)).toBe(true)
    expect(mat[0].correlativo).toBe('9012139592701')
    expect(mat[9].correlativo).toBe('9012139592710')
    expect(ara[0].correlativo).toBe('9012139592801')
    expect(mat.map((x) => x.monto).reduce((a, b) => a + b, 0)).toBe(200000)
    expect(ara.map((x) => x.monto).reduce((a, b) => a + b, 0)).toBe(3640000)
    expect(mat[9].totalAcumulado).toBe(200000)
    expect(ara[0].totalAcumulado).toBe(ara[0].monto)
    expect(ara[9].totalAcumulado).toBe(3640000)
    expect(mat[0].vencimiento).toBe('2026-09-05')
    expect(mat[9].vencimiento).toBe('2027-06-05')
    expect(ara[0].vencimiento).toBe('2026-09-05')
  })

  it('con n:12 arma 24 filas y totalCuotas 12', () => {
    const r = buildPagareCuotasDraft({ ...base, n: 12 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(24)
    const mat = r.rows.filter((x) => x.items === 'MATRICULA')
    const ara = r.rows.filter((x) => x.items === 'ARANCEL')
    expect(mat).toHaveLength(12)
    expect(ara).toHaveLength(12)
    expect(mat.every((x) => x.totalCuotas === 12)).toBe(true)
    expect(ara.every((x) => x.totalCuotas === 12)).toBe(true)
    expect(mat[0].correlativo).toBe('9012139592701')
    expect(mat[11].correlativo).toBe('9012139592712')
    expect(ara[0].correlativo).toBe('9012139592801')
    expect(ara[11].correlativo).toBe('9012139592812')
    expect(mat.map((x) => x.monto).reduce((a, b) => a + b, 0)).toBe(200000)
    expect(ara.map((x) => x.monto).reduce((a, b) => a + b, 0)).toBe(3640000)
    expect(mat[11].vencimiento).toBe('2027-08-05')
    expect(ara[11].vencimiento).toBe('2027-08-05')
  })

  it('rechaza fecha que no cae en el día de vencimiento', () => {
    const r = buildPagareCuotasDraft({ ...base, fechaInicio: '2026-09-15' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/día 5/)
  })

  it('rechaza fecha anterior a hoy', () => {
    const r = buildPagareCuotasDraft({ ...base, fechaInicio: '2026-08-05' })
    expect(r.ok).toBe(false)
  })
})
