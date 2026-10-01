import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type AlumnoDeudaNetParams = {
  rut: string
  opcion?: number
  noMostrar?: number
  fecCaja?: string
  ambiente?: 'prod' | 'test'
  host?: string
}

export type AlumnoDeudaNetData = {
  deuda: string
  tieneDeuda: boolean
  raw?: Record<string, unknown>
}

export type AlumnoDeudaNetResponse = {
  ok: boolean
  message?: string
  data?: AlumnoDeudaNetData
  error?: string
  code?: string
  params?: AlumnoDeudaNetParams
  duracionMs?: number
}

/** RUT cuerpo sin dígito verificador (para @RUT del SP). */
export function rutSinDv(rut: string): string {
  const t = rut.trim().toUpperCase().replace(/\./g, '').replace(/\s/g, '')
  if (!t) return ''
  if (t.includes('-')) return t.split('-')[0].replace(/\D/g, '')
  const alnum = t.replace(/[^0-9K]/g, '')
  if (/^\d{1,8}$/.test(alnum)) return alnum
  if (/^\d+[0-9K]$/.test(alnum)) return alnum.slice(0, -1)
  return alnum.replace(/\D/g, '')
}

/**
 * CODCLI de MT_CLIENT / SPs de contacto-discapacidad = RUT sin DV.
 * No usar el `codcli` del plan de pagos (código Excel ~15 chars).
 */
export function codcliMtClientDesdeRut(rutCompleto: string): string {
  return rutSinDv(rutCompleto)
}

const TIMEOUT_MS = 60_000

export async function fetchAlumnoDeudaNet(
  params: AlumnoDeudaNetParams,
): Promise<AlumnoDeudaNetResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/deuda-net`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut: params.rut,
        opcion: params.opcion ?? 124,
        noMostrar: params.noMostrar ?? 0,
      }),
      signal: controller.signal,
    })

    let body: AlumnoDeudaNetResponse
    try {
      body = (await res.json()) as AlumnoDeudaNetResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al consultar deuda`,
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
      return { ok: false, error: 'Timeout consultando deuda en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
