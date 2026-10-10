import { describe, expect, it } from 'vitest'
import { fonoactParaSp } from '@/services/actualizarDatosMolApi'
import {
  enmascararTelefonoChile,
  extraerDigitosTelefonoChile,
  normalizarTelefonoChile,
  TELEFONO_CHILE_PREFIJO,
  telefonoChileEsValido,
} from '@/utils/telefonoChile'

describe('extraerDigitosTelefonoChile', () => {
  it('deja los 9 dígitos aunque partan con 9, 8, 7 o 56', () => {
    expect(extraerDigitosTelefonoChile('987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('812345678')).toBe('812345678')
    expect(extraerDigitosTelefonoChile('712345678')).toBe('712345678')
    expect(extraerDigitosTelefonoChile('561234567')).toBe('561234567')
  })

  it('quita el 56 de país solo cuando el pegado trae 11 dígitos', () => {
    expect(extraerDigitosTelefonoChile('+56987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('56987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('+56 9 8765 4321')).toBe('987654321')
  })

  it('no convierte un pegado de otro largo en un número de 9', () => {
    expect(extraerDigitosTelefonoChile('1234567890')).toBe('1234567890')
    expect(extraerDigitosTelefonoChile('569876543210')).toBe('56987654321')
    expect(extraerDigitosTelefonoChile('12345678')).toBe('12345678')
  })
})

describe('normalizarTelefonoChile', () => {
  it('guarda +56 más los 9 dígitos nacionales', () => {
    expect(TELEFONO_CHILE_PREFIJO).toBe('+56')
    expect(normalizarTelefonoChile('987654321')).toBe('+56987654321')
    expect(normalizarTelefonoChile('+56987654321')).toBe('+56987654321')
    expect(normalizarTelefonoChile('561234567')).toBe('+56561234567')
    expect(normalizarTelefonoChile('812345678')).toBe('+56812345678')
    expect(normalizarTelefonoChile('12345678')).toBe('+5612345678')
  })

  it('acepta solo +56 y exactamente 9 dígitos', () => {
    expect(telefonoChileEsValido('+56987654321')).toBe(true)
    expect(telefonoChileEsValido('+56812345678')).toBe(true)
    expect(telefonoChileEsValido('+56561234567')).toBe(true)
    expect(telefonoChileEsValido(normalizarTelefonoChile('12345678'))).toBe(false)
    expect(telefonoChileEsValido(normalizarTelefonoChile('1234567890'))).toBe(false)
    expect(telefonoChileEsValido(normalizarTelefonoChile('569876543210'))).toBe(false)
  })

  it('manda al ERP los dígitos sin el signo más', () => {
    expect(fonoactParaSp(normalizarTelefonoChile('987654321'))).toBe('56987654321')
    expect(fonoactParaSp(normalizarTelefonoChile('812345678'))).toBe('56812345678')
  })
})

describe('enmascararTelefonoChile', () => {
  it('enmascara un número válido con +56, cinco asteriscos y los últimos 4', () => {
    expect(enmascararTelefonoChile('+56987654321')).toBe('+56*****4321')
    expect(enmascararTelefonoChile('812345678')).toBe('+56*****5678')
  })

  it('devuelve *** si el número no es válido', () => {
    expect(enmascararTelefonoChile('12345678')).toBe('***')
  })
})
