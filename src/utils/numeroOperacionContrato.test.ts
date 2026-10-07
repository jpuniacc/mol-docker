import { describe, expect, it } from 'vitest'
import { numeroOperacionContrato } from '@/utils/numeroOperacionContrato'

describe('numeroOperacionContrato', () => {
  it('prefiere el número de la cuenta grabada sobre el guion del pagaré', () => {
    expect(numeroOperacionContrato('—', '940682')).toBe('940682')
    expect(numeroOperacionContrato(undefined, null)).toBe('—')
    expect(numeroOperacionContrato('918341', '940682')).toBe('918341')
  })
})
