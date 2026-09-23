import { admisionApiBaseUrl } from '@/constants/admisionApi'

const TIMEOUT_MS = 60_000

export type ActualizarDatosMolPayload = {
  codcli: string
  fonoact: string
  mail: string
}

export type ActualizarDatosMolResponse = {
  ok: boolean
  message?: string
  error?: string
  code?: string
  data?: {
    resultado: number
    mensaje: string
    raw?: Record<string, unknown>
  }
  params?: {
    codcli: string
    fonoact: string
    mail: string
    ambiente?: 'prod' | 'test'
    host?: string
  }
  duracionMs?: number
  syncStatus?: string
}

function apiUrl(path: string): string {
  const base = admisionApiBaseUrl()
  return base ? `${base}${path}` : path
}

/** Dígitos para @FONOACT del SP (ej. 56987654321), sin '+'. */
export function fonoactParaSp(telefonoUi: string): string {
  return telefonoUi.replace(/\D/g, '')
}

export async function actualizarDatosMolErp(
  payload: ActualizarDatosMolPayload,
): Promise<ActualizarDatosMolResponse> {
  const url = apiUrl('/api/rematricula/contacto/actualizar-datos-erp')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codcli: payload.codcli.trim(),
        fonoact: payload.fonoact.trim(),
        mail: payload.mail.trim(),
      }),
      signal: controller.signal,
    })

    let body: ActualizarDatosMolResponse
    try {
      body = (await res.json()) as ActualizarDatosMolResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al actualizar datos en ERP`,
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: body.error || body.message || `Error HTTP ${res.status}`,
        ...body,
      }
    }

    return body
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout actualizando datos de contacto en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
