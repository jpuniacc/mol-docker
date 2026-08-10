import { describe, expect, it } from 'vitest'

import { periodoActivoLabel } from '@/services/periodoActivo'

describe('periodoActivoLabel', () => {
  it('formatea año y semestre', () => {
    expect(periodoActivoLabel(2026, 2)).toBe('2026-2')
    expect(periodoActivoLabel(2027, 1)).toBe('2027-1')
  })
})
