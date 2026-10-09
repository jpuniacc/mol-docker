import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  guardarCanalOtpEnCurso,
  leerOtpEnCurso,
  limpiarCanalOtpEnCurso,
} from './contactoOtpEnCurso'

describe('contacto OTP en curso', () => {
  beforeEach(() => {
    const datos = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (clave: string) => datos.get(clave) ?? null,
      setItem: (clave: string, valor: string) => {
        datos.set(clave, valor)
      },
      removeItem: (clave: string) => {
        datos.delete(clave)
      },
      clear: () => {
        datos.clear()
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recupera el código enviado mientras no caduque', () => {
    const ahora = Date.now()
    guardarCanalOtpEnCurso('telefono', {
      destino: '964255300',
      validezDesdeMs: ahora,
      expiresAt: new Date(ahora + 60_000).toISOString(),
      proximoReintentoAt: ahora + 30_000,
      envios: 1,
      intentosFallidos: 0,
    })

    expect(leerOtpEnCurso(ahora).telefono?.destino).toBe('964255300')
  })

  it('descarta el canal cuando el código ya caducó', () => {
    const ahora = Date.now()
    guardarCanalOtpEnCurso('correo', {
      destino: 'ana@correo.cl',
      validezDesdeMs: ahora - 10_000,
      expiresAt: new Date(ahora - 1_000).toISOString(),
      proximoReintentoAt: null,
      envios: 1,
      intentosFallidos: 2,
    })

    expect(leerOtpEnCurso(ahora).correo).toBeNull()
  })

  it('limpia solo el canal indicado', () => {
    const ahora = Date.now()
    const vigente = {
      validezDesdeMs: ahora,
      expiresAt: new Date(ahora + 60_000).toISOString(),
      proximoReintentoAt: null,
      envios: 1,
      intentosFallidos: 0,
    }
    guardarCanalOtpEnCurso('correo', { ...vigente, destino: 'ana@correo.cl' })
    guardarCanalOtpEnCurso('telefono', { ...vigente, destino: '964255300' })

    limpiarCanalOtpEnCurso('correo')

    const guardado = leerOtpEnCurso(ahora)
    expect(guardado.correo).toBeNull()
    expect(guardado.telefono?.destino).toBe('964255300')
  })
})
