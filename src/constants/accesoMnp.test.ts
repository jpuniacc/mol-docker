import { describe, expect, it } from 'vitest'

import { MSG_SITUACION_ACADEMICA, TITULO_ACCESO_NO_VIGENTE, mensajeAccesoNoVigente } from './accesoMnp'

describe('mensajeAccesoNoVigente', () => {
  it('pide revisión académica en servicio al estudiante', () => {
    expect(TITULO_ACCESO_NO_VIGENTE).toBe('No es posible continuar con tu proceso de rematrícula')
    expect(mensajeAccesoNoVigente(['ELIMINADO', 'SUSPENDIDO'])).toBe(MSG_SITUACION_ACADEMICA)
    expect(MSG_SITUACION_ACADEMICA).toContain('situación académica')
    expect(MSG_SITUACION_ACADEMICA).toContain('Portal de Solicitudes UNIACC')
    expect(MSG_SITUACION_ACADEMICA).not.toContain('servicio.estudiante')
  })
})
