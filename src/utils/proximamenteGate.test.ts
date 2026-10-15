import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_DESBLOQUEO_PROXIMAMENTE } from '@/constants/proximamente'
import type { LoginResult } from '@/services/auth'
import {
  clasificarDesbloqueo,
  guardarDesbloqueoProximamente,
  leerDesbloqueoProximamente,
  mensajeProximamenteGuardable,
  mensajeProximamenteVisible,
  redireccionProximamente,
} from '@/utils/proximamenteGate'

const alumno: LoginResult = {
  ok: true,
  authSource: 'pixarron',
  email: 'alumno@uniacc.cl',
  localPart: 'alumno',
  mvUsuario: null,
  tipoPixarron: 'alumno',
}

const administrativo: LoginResult = {
  ok: true,
  authSource: 'mv_ldap',
  email: 'ana.perez@uniacc.cl',
  localPart: 'ana.perez',
  mvUsuario: { codigo_grupo: 2 },
  tipoPixarron: null,
}

describe('redireccionProximamente', () => {
  it('manda al login cuando el interruptor está apagado', () => {
    expect(
      redireccionProximamente({ routeName: 'proximamente', activo: false, desbloqueado: false }),
    ).toBe('login')
    expect(
      redireccionProximamente({ routeName: 'login', activo: false, desbloqueado: false }),
    ).toBeNull()
  })

  it('muestra Próximamente si está prendido y la pestaña no está desbloqueada', () => {
    expect(
      redireccionProximamente({ routeName: 'login', activo: true, desbloqueado: false }),
    ).toBe('proximamente')
    expect(
      redireccionProximamente({ routeName: 'home', activo: true, desbloqueado: false }),
    ).toBe('proximamente')
    expect(
      redireccionProximamente({ routeName: 'proximamente', activo: true, desbloqueado: false }),
    ).toBeNull()
  })

  it('abre el login si la pestaña ya está desbloqueada', () => {
    expect(
      redireccionProximamente({ routeName: 'proximamente', activo: true, desbloqueado: true }),
    ).toBe('login')
    expect(
      redireccionProximamente({ routeName: 'login', activo: true, desbloqueado: true }),
    ).toBeNull()
  })
})

describe('clasificarDesbloqueo', () => {
  it('rechaza la contraseña incorrecta con el mensaje del servicio', () => {
    expect(clasificarDesbloqueo({ ok: false, message: 'Usuario o contraseña incorrectos' })).toEqual({
      ok: false,
      message: 'Usuario o contraseña incorrectos',
    })
  })

  it('rechaza a un alumno', () => {
    expect(clasificarDesbloqueo(alumno)).toEqual({
      ok: false,
      message: 'Este acceso es solo para administrativos.',
    })
  })

  it('acepta a un administrativo sin abrir sesión', () => {
    expect(clasificarDesbloqueo(administrativo)).toEqual({ ok: true })
  })
})

describe('mensaje de Próximamente', () => {
  it('no guarda un mensaje vacío', () => {
    expect(mensajeProximamenteGuardable('   ')).toBe(false)
    expect(mensajeProximamenteGuardable('Hola, ya abrimos.')).toBe(true)
  })

  it('oculta el párrafo si el mensaje llega en blanco', () => {
    expect(mensajeProximamenteVisible('  ')).toBe('')
    expect(mensajeProximamenteVisible('Texto')).toBe('Texto')
  })
})

describe('desbloqueo de la pestaña', () => {
  beforeEach(() => {
    sessionStorage.removeItem(STORAGE_DESBLOQUEO_PROXIMAMENTE)
  })

  it('parte cerrado y queda abierto en esta pestaña', () => {
    expect(leerDesbloqueoProximamente()).toBe(false)
    guardarDesbloqueoProximamente()
    expect(leerDesbloqueoProximamente()).toBe(true)
  })
})
