import { admisionApiBaseUrl } from '@/constants/admisionApi'

const TIMEOUT_MS = 60_000

export type ActualizarDiscapacidadMolPayload = {
  codcli: string
  discapacidad: string
}

export type ActualizarDiscapacidadMolResponse = {
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
    discapacidad: string
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

export async function actualizarDiscapacidadMolErp(
  payload: ActualizarDiscapacidadMolPayload,
): Promise<ActualizarDiscapacidadMolResponse> {
  const url = apiUrl('/api/rematricula/discapacidad/actualizar-erp')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codcli: payload.codcli.trim(),
        discapacidad: payload.discapacidad.trim(),
      }),
      signal: controller.signal,
    })

    let body: ActualizarDiscapacidadMolResponse
    try {
      body = (await res.json()) as ActualizarDiscapacidadMolResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al actualizar discapacidad en ERP`,
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
      return { ok: false, error: 'Timeout actualizando discapacidad en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
