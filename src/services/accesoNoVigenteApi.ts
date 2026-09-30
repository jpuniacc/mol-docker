import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { mensajeAccesoNoVigente } from '@/constants/accesoMnp'
import type { MnpDatosAlumnosRow } from '@/types/supabase'
import { rutNorm } from '@/utils/rutNorm'

const AVISO_KEY = 'rematricula-acceso-no-vigente'
const avisosEnCurso = new Set<string>()

function apiPath(path: string): string {
  const base = admisionApiBaseUrl()
  return base ? `${base}${path}` : path
}

export function guardarAvisoNoVigente(mensaje: string): void {
  sessionStorage.setItem(AVISO_KEY, mensaje)
}

export function tomarAvisoNoVigente(): string | null {
  const mensaje = sessionStorage.getItem(AVISO_KEY)
  if (mensaje) sessionStorage.removeItem(AVISO_KEY)
  return mensaje
}

async function notificarAccesoNoVigente(rut: string): Promise<void> {
  const norm = rutNorm(rut)
  if (!norm || avisosEnCurso.has(norm)) return
  avisosEnCurso.add(norm)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    await fetch(apiPath('/api/rematricula/acceso/no-vigente'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rutAlumno: rut.trim() }),
      signal: controller.signal,
    })
  } catch (error) {
    console.warn('[acceso-no-vigente] no se pudo registrar el aviso', error)
  } finally {
    clearTimeout(timer)
  }
}

/** Deja el mensaje para el login y avisa al ejecutivo y a mol@uniacc.cl. */
export async function registrarIntentoNoVigente(filas: MnpDatosAlumnosRow[]): Promise<string> {
  const mensaje = mensajeAccesoNoVigente(filas.map((fila) => fila.estado_academico))
  guardarAvisoNoVigente(mensaje)
  const rut = filas.find((fila) => (fila.rut_alumno ?? '').trim())?.rut_alumno ?? ''
  await notificarAccesoNoVigente(rut)
  return mensaje
}
