import { describe, expect, it } from 'vitest'

import { fueraCarteraDesdeEstado } from './carteraOficial'

describe('fueraCarteraDesdeEstado', () => {
  it('fail-open si la cartera no está cargada', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: false, enCartera: false, excluidoMol: true }),
    ).toBe(false)
  })

  it('bloquea si el RUT no está en la tabla', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: false, excluidoMol: false }),
    ).toBe(true)
  })

  it('bloquea SUBDERE aunque el RUT esté en cartera (174202192)', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: true }),
    ).toBe(true)
  })

  it('deja pasar un RUT en cartera y no excluido', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: false }),
    ).toBe(false)
  })
})
