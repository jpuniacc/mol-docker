import { describe, expect, it } from 'vitest'

import {
  REINTENTOS_ENLACE_FIRMA,
  esEnlaceFirmaPendiente,
  intentosAntesDelModalEnlace,
} from './reintentoEnlaceFirma'

describe('reintento del enlace de firma', () => {
  it('hace tres reintentos después del primer 409 antes del modal', () => {
    expect(REINTENTOS_ENLACE_FIRMA).toBe(3)
    expect(intentosAntesDelModalEnlace()).toBe(4)
  })

  it('reconoce el 409 de enlace pendiente', () => {
    expect(esEnlaceFirmaPendiente('Ese firmante no tiene un enlace de firma pendiente')).toBe(true)
    expect(esEnlaceFirmaPendiente('El número de operación ya está asociado a otro alumno')).toBe(false)
  })
})