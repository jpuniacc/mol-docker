import { describe, expect, it } from 'vitest'
import {
  APODERADO_SIN_INFO,
  esPropioSostenedor,
  mailApoderadoDisplay,
  nombreCompletoApoderado,
  telefonoApoderadoDisplay,
} from './apoderadoResponsable'

describe('esPropioSostenedor', () => {
  it('true solo para S', () => {
    expect(esPropioSostenedor('S')).toBe(true)
    expect(esPropioSostenedor(' s ')).toBe(true)
    expect(esPropioSostenedor('N')).toBe(false)
    expect(esPropioSostenedor('sin datos')).toBe(false)
    expect(esPropioSostenedor(null)).toBe(false)
    expect(esPropioSostenedor(undefined)).toBe(false)
  })
})

describe('displays', () => {
  it('arma nombre y fallbacks', () => {
    expect(
      nombreCompletoApoderado({
        nombre_apoderado: 'Ana',
        apellido_paterno_apoderado: 'Pérez',
        apellido_materno_apoderado: 'López',
      }),
    ).toBe('Ana Pérez López')
    expect(
      nombreCompletoApoderado({
        nombre_apoderado: null,
        apellido_paterno_apoderado: null,
        apellido_materno_apoderado: null,
      }),
    ).toBe(APODERADO_SIN_INFO)
    expect(
      telefonoApoderadoDisplay({ telefono_apoder: null, telefono_apoderado: '56911112222' }),
    ).toBe('56911112222')
    expect(mailApoderadoDisplay({ mail_apoder: '  ' })).toBe(APODERADO_SIN_INFO)
  })
})
