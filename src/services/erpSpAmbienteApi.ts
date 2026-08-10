import { admisionApiBaseUrl } from '@/constants/admisionApi'
import type { ErpSpAmbiente } from '@/services/erpSpAmbiente'

export type ErpSpAmbienteApiActivo = {
  ambiente: ErpSpAmbiente
  label: string
  host: string
}

export type ErpSpAmbientePingResponse = {
  ok: boolean
  ambiente?: ErpSpAmbiente
  host?: string
  duracionMs?: number
  message?: string
  error?: string
}

const TIMEOUT_MS = 30_000

export async function pingErpSpAmbienteApi(
  ambiente?: ErpSpAmbiente,
): Promise<ErpSpAmbientePingResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/erp-sp-ambiente/ping`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ambiente ? { ambiente } : {}),
      signal: controller.signal,
    })
    let body: ErpSpAmbientePingResponse
    try {
      body = (await res.json()) as ErpSpAmbientePingResponse
    } catch {
      return {
        ok: false,
        error: res.ok ? 'Respuesta inválida' : `Error HTTP ${res.status}`,
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
      return { ok: false, error: 'Timeout al hacer ping al ERP SP' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}
