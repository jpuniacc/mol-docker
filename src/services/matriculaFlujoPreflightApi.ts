import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { rutSinDv } from '@/services/alumnoDeudaNetApi'

export { rutSinDv }

export type CorrelativoPeek = {
  actual: string | null
  preview: string | null
}

export type MatriculaFlujoPreflightSteps = {
  deuda: {
    ok: boolean
    tieneDeuda: boolean
    deuda: string | null
    error?: string
  }
  tipomat: {
    ok: boolean
    row: {
      tipomat: number
      descripcion: string | null
      periodoMat: number | null
      anoMat: number | null
      periodos: number | null
      periodosAnuales: number | null
    } | null
    error?: string
  }
  caja: {
    ok: boolean
    abierta: boolean
    row: {
      caja: number
      tipo: string | null
      abierta: string | null
      fecha: string | null
      usuario: string | null
    } | null
    error?: string
  }
  parametros: {
    ok: boolean
    faltantes: string[]
    error?: string
  }
  correlativos: {
    SECUENCIA: CorrelativoPeek
    CORRELATIVO: CorrelativoPeek
    CORRPAGNUM: CorrelativoPeek
    CORRCONTRATO: CorrelativoPeek
  }
  contrato: {
    actual: string | null
    preview: string | null
    codCarr: string
    ano: string | null
    periodo: string | null
  }
}

export type MatriculaFlujoPreflightParams = {
  rut: string
  codCarr: string
  tipomat?: number
  caja?: number
  codgrupo?: number
  ambiente?: 'prod' | 'test'
  host?: string
}

export type MatriculaFlujoPreflightResponse = {
  ok: boolean
  message?: string
  steps?: MatriculaFlujoPreflightSteps
  params?: MatriculaFlujoPreflightParams
  duracionMs?: number
  error?: string
}

const TIMEOUT_MS = 90_000

export async function fetchMatriculaFlujoPreflight(
  params: MatriculaFlujoPreflightParams,
): Promise<MatriculaFlujoPreflightResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/flujo-preflight`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut: params.rut,
        codCarr: params.codCarr,
        tipomat: params.tipomat,
        caja: params.caja,
        codgrupo: params.codgrupo,
      }),
      signal: controller.signal,
    })

    let body: MatriculaFlujoPreflightResponse
    try {
      body = (await res.json()) as MatriculaFlujoPreflightResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al consultar preflight`,
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
      return { ok: false, error: 'Timeout consultando preflight en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
