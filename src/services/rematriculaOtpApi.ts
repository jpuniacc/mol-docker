import { admisionApiBaseUrl } from '@/constants/admisionApi'

/** Evita fetch colgado si el proxy no alcanza uniacc-api o SMTP tarda mucho. */
const OTP_FETCH_TIMEOUT_MS = 90_000

function apiPath(path: string): string {
  const base = admisionApiBaseUrl()
  return base ? `${base}${path}` : path
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OTP_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError') {
      const hint =
        import.meta.env.DEV && typeof window !== 'undefined'
          ? ` URL usada: ${url}.`
          : ''
      throw new Error(
        `Tiempo de espera agotado (${OTP_FETCH_TIMEOUT_MS / 1000}s). Comprueba uniacc-api, VITE_API_URL o VITE_ADMISION_API_TARGET, y SMTP.${hint}`,
      )
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export type SolicitarOtpEmailPayload = {
  usuarioConexion: string
  emailInstitucional: string
  emailPersonal: string
  /** URL del documento al solicitar el código (auditoría). */
  urlOrigen?: string | null
}

export async function solicitarOtpEmailCorreoPersonal(
  payload: SolicitarOtpEmailPayload,
): Promise<{ ok: true; expiresAt: string } | { ok: false; message: string }> {
  let res: Response
  try {
    res = await fetchWithTimeout(apiPath('/api/rematricula/contacto-otp/email/solicitar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo conectar con el servidor.'
    return { ok: false, message: msg }
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string; expiresAt?: string }
  if (!res.ok) {
    return {
      ok: false,
      message: typeof data.message === 'string' ? data.message : 'No se pudo enviar el código.',
    }
  }
  if (typeof data.expiresAt !== 'string') {
    return { ok: false, message: 'Respuesta inválida del servidor.' }
  }
  return { ok: true, expiresAt: data.expiresAt }
}

export async function verificarOtpEmailCorreoPersonal(
  payload: SolicitarOtpEmailPayload & { codigo: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response
  try {
    res = await fetchWithTimeout(apiPath('/api/rematricula/contacto-otp/email/verificar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo conectar con el servidor.'
    return { ok: false, message: msg }
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    return {
      ok: false,
      message: typeof data.message === 'string' ? data.message : 'Código incorrecto o caducado.',
    }
  }
  return { ok: true }
}
