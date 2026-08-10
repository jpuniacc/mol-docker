import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type CaeArancelReferenciaSyncResponse = {
  ok: boolean
  message?: string
  filasCargadas?: number
  duracionMs?: number
  error?: string
}

const SYNC_TIMEOUT_MS = 15 * 60 * 1000

export async function syncCaeArancelReferenciaFromErp(): Promise<CaeArancelReferenciaSyncResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/cae-arancel-referencia/sync`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    let body: CaeArancelReferenciaSyncResponse
    try {
      body = (await res.json()) as CaeArancelReferenciaSyncResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al sincronizar aranceles referencia CAE`,
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
