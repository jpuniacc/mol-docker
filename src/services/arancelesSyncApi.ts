import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type ArancelesSyncResponse = {
  ok: boolean
  message?: string
  filasCargadas?: number
  duracionMs?: number
  error?: string
}

const SYNC_TIMEOUT_MS = 15 * 60 * 1000

export async function syncArancelesFromErp(): Promise<ArancelesSyncResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/aranceles/sync`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    let body: ArancelesSyncResponse
    try {
      body = (await res.json()) as ArancelesSyncResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al sincronizar aranceles`,
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
      return {
        ok: false,
        error: `Tiempo de espera agotado (${SYNC_TIMEOUT_MS / 1000}s). El ETL puede seguir ejecutándose en el servidor.`,
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo conectar con la API',
    }
  } finally {
    clearTimeout(timer)
  }
}
