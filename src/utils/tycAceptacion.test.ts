import { describe, expect, it } from 'vitest'

import { debeSaltarPasoTyc } from './tycAceptacion'

describe('debeSaltarPasoTyc', () => {
  it('salta si ya aceptó en esta sesión', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: true,
        ultimaRespuesta: null,
        tycUpdatedAtActual: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('salta si la última respuesta persistida es aceptación de la versión vigente', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: { accion: 'acepta', tycUpdatedAt: '2026-09-01T00:00:00.000Z' },
        tycUpdatedAtActual: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('no salta si la última respuesta persistida es un rechazo', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: { accion: 'rechaza', tycUpdatedAt: '2026-09-01T00:00:00.000Z' },
        tycUpdatedAtActual: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('no salta si nunca respondió', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: null,
        tycUpdatedAtActual: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('no salta si aceptó una versión anterior del documento', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: { accion: 'acepta', tycUpdatedAt: '2026-08-01T00:00:00.000Z' },
        tycUpdatedAtActual: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('salta si la versión vigente es el mismo instante con otro formato ISO', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: { accion: 'acepta', tycUpdatedAt: '2026-09-01T00:00:00.000Z' },
        tycUpdatedAtActual: '2026-09-01T00:00:00+00:00',
      }),
    ).toBe(true)
  })

  it('no salta si hay aceptación persistida pero no hay versión vigente cargada', () => {
    expect(
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: { accion: 'acepta', tycUpdatedAt: '2026-09-01T00:00:00.000Z' },
        tycUpdatedAtActual: null,
      }),
    ).toBe(false)
  })
})
