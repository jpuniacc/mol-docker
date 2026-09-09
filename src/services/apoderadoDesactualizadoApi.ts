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

export type AvisarApoderadoDesactualizadoPayload = {
  rutAlumno: string
  codcli: string
  nombreAlumno: string
  periodoLabel: string
  carrera: string
  jornada: string
  apoderadoNombre: string
  apoderadoTelefono: string
  apoderadoEmail: string
  urlOrigen?: string | null
}

export async function avisarApoderadoDesactualizado(
  payload: AvisarApoderadoDesactualizadoPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response
  try {
    res = await fetchWithTimeout(apiPath('/api/rematricula/apoderado/aviso-desactualizado'), {
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
      message: typeof data.message === 'string' ? data.message : 'No se pudo enviar el aviso.',
    }
  }
  return { ok: true }
}
