import { describe, expect, it } from 'vitest'

import {
  MSG_BECA_SUBDERE,
  MSG_DEUDA_PENDIENTE,
  MSG_FUERA_CARTERA_OFICIAL,
  TEXTO_ENLACE_PORTAL_SOLICITUDES,
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

  it('los avisos de bloqueo apuntan al portal de solicitudes', () => {
    expect(TITULO_BECA_SUBDERE).toBe('No es posible continuar con tu proceso de rematrícula')
    expect(MSG_BECA_SUBDERE).toContain('beneficio SUBDERE')
    expect(MSG_BECA_SUBDERE).toContain(TEXTO_ENLACE_PORTAL_SOLICITUDES)
    expect(MSG_BECA_SUBDERE).not.toContain('servicio.estudiante')
    expect(MSG_FUERA_CARTERA_OFICIAL).toContain(TEXTO_ENLACE_PORTAL_SOLICITUDES)
    expect(MSG_FUERA_CARTERA_OFICIAL).not.toContain('servicio.estudiante')
    expect(MSG_DEUDA_PENDIENTE).toContain('Portal de Solicitudes')
    expect(MSG_DEUDA_PENDIENTE).not.toContain('servicio.estudiante')
  })

  it('deja pasar un RUT en cartera y no excluido', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: false }),
    ).toBe(false)
  })
})
