const CLAVE = 'mol-rematricula-otp-en-curso'

export type CanalOtpEnCurso = {
  destino: string
  validezDesdeMs: number
  expiresAt: string
  proximoReintentoAt: number | null
  envios: number
  intentosFallidos: number
}

export type OtpEnCursoGuardado = {
  correo: CanalOtpEnCurso | null
  telefono: CanalOtpEnCurso | null
}

function vacio(): OtpEnCursoGuardado {
  return { correo: null, telefono: null }
}

function almacenamiento(): Storage | null {
  const candidato = globalThis.sessionStorage
  if (!candidato) return null
  return candidato
}

function canalVigente(canal: CanalOtpEnCurso | null, ahora: number): CanalOtpEnCurso | null {
  if (!canal || !canal.destino.trim()) return null
  const expira = Date.parse(canal.expiresAt)
  if (!Number.isFinite(expira) || expira <= ahora) return null
  return canal
}

export function leerOtpEnCurso(ahora = Date.now()): OtpEnCursoGuardado {
  const storage = almacenamiento()
  if (!storage) return vacio()
  try {
    const raw = storage.getItem(CLAVE)
    if (!raw) return vacio()
    const parsed = JSON.parse(raw) as Partial<OtpEnCursoGuardado>
    const guardado: OtpEnCursoGuardado = {
      correo: canalVigente(parsed.correo ?? null, ahora),
      telefono: canalVigente(parsed.telefono ?? null, ahora),
    }
    if (!guardado.correo || !guardado.telefono) {
      storage.setItem(CLAVE, JSON.stringify(guardado))
    }
    return guardado
  } catch {
    return vacio()
  }
}

export function guardarCanalOtpEnCurso(
  canal: 'correo' | 'telefono',
  datos: CanalOtpEnCurso,
): void {
  const storage = almacenamiento()
  if (!storage) return
  const actual = leerOtpEnCurso()
  actual[canal] = datos
  storage.setItem(CLAVE, JSON.stringify(actual))
}

export function limpiarCanalOtpEnCurso(canal: 'correo' | 'telefono'): void {
  const storage = almacenamiento()
  if (!storage) return
  const actual = leerOtpEnCurso()
  actual[canal] = null
  storage.setItem(CLAVE, JSON.stringify(actual))
}
