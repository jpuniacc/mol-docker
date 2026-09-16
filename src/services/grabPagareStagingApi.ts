import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type GrabPagareCuotaPayload = {
  item: 1 | 2
  cuota: number
  numcuot: number
  monto: number
  fecven: string
}

export type GrabPagareStagingPayload = {
  codcli: string
  codcarr: string
  sede: string | null
  jornada: string | null
  codapod: string
  ano: number
  periodo: number
  caja: number
  fechaCaja: string
  usuario?: string
  numOperacion: string
  contrato: string
  secuenciaBoleta1: string
  secuenciaBoleta2: string
  corrpagMat: string
  corrpagAra: string
  montoMatricula: number
  montoArancel: number
  cuotas: GrabPagareCuotaPayload[]
}

export type GrabPagareStagingResponse = {
  ok: boolean
  message?: string
  numOperacion?: string
  counts?: { docitem: number; ctadoc: number; ctapag: number; ctadep: number }
  error?: string
}

const TIMEOUT_MS = 90_000

export async function postGrabPagareStaging(
  payload: GrabPagareStagingPayload,
): Promise<GrabPagareStagingResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/grab-pagare-staging`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    let body: GrabPagareStagingResponse
    try {
      body = (await res.json()) as GrabPagareStagingResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al grabar pagaré`,
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: body.error || body.message || `Error HTTP ${res.status}`,
        message: body.message,
        numOperacion: body.numOperacion,
        counts: body.counts,
      }
    }

    return body
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout grabando pagaré en staging' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
