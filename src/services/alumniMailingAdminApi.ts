import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type AlumniMailingStatus = 'pending' | 'sent' | 'error'

export type AlumniMailingFila = {
  token: string
  lote: string
  nombre: string
  email: string
  folder_num: string | null
  zip_relpath: string
  status: AlumniMailingStatus
  sent_at: string | null
  downloaded_at: string | null
  download_count: number
  error_message: string | null
}

export type AlumniMailingResumen = {
  pending: number
  sent: number
  error: number
  downloaded: number
}

export type AlumniMailingListado = {
  ok: true
  total: number
  resumen: AlumniMailingResumen
  filas: AlumniMailingFila[]
  lotes: string[]
}

export type AlumniMailingListParams = {
  lote?: string | null
  status?: AlumniMailingStatus | '' | null
  q?: string | null
  limit?: number
  offset?: number
}

export async function listarAlumniMailing(
  params: AlumniMailingListParams = {},
): Promise<AlumniMailingListado | { ok: false; error: string }> {
  const qs = new URLSearchParams()
  if (params.lote?.trim()) qs.set('lote', params.lote.trim())
  if (params.status === 'pending' || params.status === 'sent' || params.status === 'error') {
    qs.set('status', params.status)
  }
  if (params.q?.trim()) qs.set('q', params.q.trim())
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const destino = urlConCarteraEjecutivo(
      `${admisionApiBaseUrl()}/api/mailing/envios?${qs.toString()}`,
    )
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, { signal: controller.signal })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al leer mailing` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const data = body as AlumniMailingListado
    if (!data?.ok || !Array.isArray(data.filas)) {
      return { ok: false, error: 'Respuesta inválida del API mailing' }
    }
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al listar mailing' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}
