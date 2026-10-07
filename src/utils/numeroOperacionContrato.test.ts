import { describe, expect, it } from 'vitest'
import { numeroOperacionContrato } from '@/utils/numeroOperacionContrato'

describe('numeroOperacionContrato', () => {
  it('prefiere el número de la cuenta grabada sobre el guion del pagaré', () => {
    expect(numeroOperacionContrato('—', '940682')).toBe('940682')
    expect(numeroOperacionContrato(undefined, null)).toBe('—')
    expect(numeroOperacionContrato('918341', '940682')).toBe('918341')
  })

  it('con los dos Webpay manda la cuenta, aunque haya un pagaré viejo', () => {
    expect(numeroOperacionContrato('918341', '940682', { ambosWebpay: true })).toBe('940682')
    expect(numeroOperacionContrato('—', '940682', { ambosWebpay: true })).toBe('940682')
  })

  it('con los dos Webpay y sin cuenta numérica cae al pagaré o al guion', () => {
    expect(numeroOperacionContrato('918341', null, { ambosWebpay: true })).toBe('918341')
    expect(numeroOperacionContrato(undefined, '—', { ambosWebpay: true })).toBe('—')
  })

  it('sin los dos Webpay el número numérico del pagaré sigue ganando', () => {
    expect(numeroOperacionContrato('918341', '940682', { ambosWebpay: false })).toBe('918341')
  })
})
