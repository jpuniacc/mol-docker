import { describe, expect, it } from 'vitest'

import {
  CORREO_BECA_SUBDERE,
  MSG_BECA_SUBDERE,
  TITULO_BECA_SUBDERE,
  fueraCarteraDesdeEstado,
} from './carteraOficial'

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

  it('el aviso SUBDERE usa el correo de servicio al estudiante', () => {
    expect(TITULO_BECA_SUBDERE).toBe('No es posible continuar con tu proceso de rematrícula')
    expect(MSG_BECA_SUBDERE).toContain('Beca SUBDERE')
    expect(MSG_BECA_SUBDERE).toContain(CORREO_BECA_SUBDERE)
  })

  it('deja pasar un RUT en cartera y no excluido', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: false }),
    ).toBe(false)
  })
})
