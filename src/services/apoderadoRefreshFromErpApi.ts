import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type ApoderadoRefreshResponse = {
  ok: boolean
  apoderado?: {
    codcli: string
    rutAlumno: string | null
    nombreAlumno: string | null
    rutApoderado: string | null
    nombreApoderado: string | null
    apellidoPaternoApoderado: string | null
    apellidoMaternoApoderado: string | null
    telefonoApoderado: string | null
    telefonoApoder: string | null
    mailApoder: string | null
    esResponsableFinanciero: string | null
  }
  updatedRows?: number
  avisoId?: string | null
  periodo?: string
  duracionMs?: number
  error?: string
  code?: string
}

const TIMEOUT_MS = 60_000

export async function refreshApoderadoFromErp(input: {
  codcli: string
  casoId?: string | null
  rutAlumno?: string | null
  nombreAlumno?: string | null
  carrera?: string | null
  jornada?: string | null
  esMock?: boolean
}): Promise<ApoderadoRefreshResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/apoderado/refresh-from-erp`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codcli: input.codcli,
        casoId: input.casoId ?? undefined,
        rutAlumno: input.rutAlumno ?? undefined,
        nombreAlumno: input.nombreAlumno ?? undefined,
        carrera: input.carrera ?? undefined,
        jornada: input.jornada ?? undefined,
        esMock: input.esMock === true,
      }),
      signal: controller.signal,
    })

    let body: ApoderadoRefreshResponse
    try {
      body = (await res.json()) as ApoderadoRefreshResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al actualizar apoderado`,
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: body.error || `Error HTTP ${res.status}`,
        code: body.code,
        ...body,
      }
    }

    return body
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Tiempo de espera agotado (${TIMEOUT_MS / 1000}s).` }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo conectar con la API',
    }
  } finally {
    clearTimeout(timer)
  }
}
