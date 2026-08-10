import { supabase } from '@/services/supabaseClient'

export type MotivoCierreSesion = 'logout' | 'beacon' | 'timeout'

export type IniciarLogSesionPayload = {
  email: string
  usuarioLocal: string
  authSource: 'mv_ldap' | 'pixarron'
  mvUsuarioId: string | null
  urlOrigen: string | null
  userAgent: string | null
}

export async function iniciarLogSesion(payload: IniciarLogSesionPayload): Promise<string | null> {
  const { data, error } = await supabase.rpc('iniciar_log_sesion', {
    p_email: payload.email,
    p_usuario_local: payload.usuarioLocal,
    p_auth_source: payload.authSource,
    p_mv_usuario_id: payload.mvUsuarioId,
    p_url_origen: payload.urlOrigen,
    p_user_agent: payload.userAgent,
  })

  if (error) {
    console.warn('[sessionLog] No se pudo iniciar log de sesión:', error.message)
    return null
  }

  return typeof data === 'string' ? data : null
}

export async function cerrarLogSesion(
  sessionId: string,
  motivo: MotivoCierreSesion,
): Promise<void> {
  const { error } = await supabase.rpc('cerrar_log_sesion', {
    p_session_id: sessionId,
    p_motivo: motivo,
  })
  if (error) {
    console.warn('[sessionLog] No se pudo cerrar log de sesión:', error.message)
  }
}

/** Cierre al cerrar pestaña/navegador vía API con keepalive (proxy inyecta API Key). */
export function cerrarLogSesionBeacon(sessionId: string): void {
  if (!sessionId) return
  const body = JSON.stringify({
    sessionId,
    motivo: 'beacon',
    origin: Number(import.meta.env.VITE_AUTH_ORIGIN) || 1,
    ambiente: Number(import.meta.env.VITE_AUTH_AMBIENTE) || 1,
  })
  fetch('/api/auth/cerrar-sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* fire-and-forget */
  })
}
