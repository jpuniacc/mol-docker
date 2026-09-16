import { describe, expect, it } from 'vitest'

import {
  periodoCatalogoLabel,
  periodoComparableKey,
  periodosEquivalentes,
} from './periodoCatalogo'

describe('periodoCatalogoLabel', () => {
  it('formatea 2027-1 como 2027-01', () => {
    expect(periodoCatalogoLabel(2027, 1)).toBe('2027-01')
    expect(periodoCatalogoLabel(2027, 2)).toBe('2027-02')
  })
})

describe('periodosEquivalentes', () => {
  it('iguala 2027-1, 2027-01 y 2027/1', () => {
    expect(periodoComparableKey('2027-1')).toBe('2027-1')
    expect(periodoComparableKey('2027-01')).toBe('2027-1')
    expect(periodoComparableKey('2027/1')).toBe('2027-1')
    expect(periodosEquivalentes('2027-1', '2027-01')).toBe(true)
    expect(periodosEquivalentes('2027/1', '2027-01')).toBe(true)
    expect(periodosEquivalentes('2027-1', '2027-02')).toBe(false)
  })
})
