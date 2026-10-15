import {
  MSG_PROXIMAMENTE_SOLO_ADMINISTRATIVOS,
  STORAGE_DESBLOQUEO_PROXIMAMENTE,
} from '@/constants/proximamente'
import type { LoginResult } from '@/services/auth'

export function mensajeProximamenteVisible(mensaje: string | null | undefined): string {
  return (mensaje ?? '').trim()
}

export function mensajeProximamenteGuardable(mensaje: string): boolean {
  return mensaje.trim().length > 0
}

export function redireccionProximamente(input: {
  routeName: string | null | undefined
  activo: boolean
  desbloqueado: boolean
}): 'login' | 'proximamente' | null {
  const name = input.routeName
  const debeVerProximamente = input.activo && !input.desbloqueado
  if (debeVerProximamente) {
    if (name === 'login' || name === 'home') return 'proximamente'
    return null
  }
  if (name === 'proximamente') return 'login'
  return null
}

export type ResultadoDesbloqueo =
  | { ok: true }
  | { ok: false; message: string }

export function clasificarDesbloqueo(result: LoginResult): ResultadoDesbloqueo {
  if (!result.ok) return { ok: false, message: result.message }
  if (!result.mvUsuario) {
    return { ok: false, message: MSG_PROXIMAMENTE_SOLO_ADMINISTRATIVOS }
  }
  return { ok: true }
}

export function leerDesbloqueoProximamente(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_DESBLOQUEO_PROXIMAMENTE) === '1'
  } catch {
    return false
  }
}

export function guardarDesbloqueoProximamente(): void {
  sessionStorage.setItem(STORAGE_DESBLOQUEO_PROXIMAMENTE, '1')
}
