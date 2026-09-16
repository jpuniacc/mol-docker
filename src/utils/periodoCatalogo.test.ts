import { describe, expect, it } from 'vitest'

import { periodoCatalogoLabel } from './periodoCatalogo'

describe('periodoCatalogoLabel', () => {
  it('formatea 2027-1 como 2027-01', () => {
    expect(periodoCatalogoLabel(2027, 1)).toBe('2027-01')
    expect(periodoCatalogoLabel(2027, 2)).toBe('2027-02')
  })
})
