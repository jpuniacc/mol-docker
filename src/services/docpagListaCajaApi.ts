import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type DocpagDespliega = 'M' | 'A' | 'T'

export type DocpagListaCajaParams = {
  despliega: DocpagDespliega
  requiereBen?: string
  idPerfil?: number
  ambiente?: 'prod' | 'test'
  host?: string
}

export type DocpagListaCajaItem = {
  tipodoc: string
  nombre: string
  requiereBen: string
  raw?: Record<string, unknown>
}

export type DocpagListaCajaResponse = {
  ok: boolean
  message?: string
  data?: DocpagListaCajaItem[]
  error?: string
  code?: string
  params?: DocpagListaCajaParams
  duracionMs?: number
}

const TIMEOUT_MS = 60_000

export async function fetchDocpagListaCaja(
  params: DocpagListaCajaParams,
): Promise<DocpagListaCajaResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/docpag/lista-caja`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        despliega: params.despliega,
        requiereBen: params.requiereBen ?? 'N',
        idPerfil: params.idPerfil ?? 1,
      }),
      signal: controller.signal,
    })

    let body: DocpagListaCajaResponse
    try {
      body = (await res.json()) as DocpagListaCajaResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al listar documentos de pago`,
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
      return { ok: false, error: 'Timeout listando documentos de pago en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
