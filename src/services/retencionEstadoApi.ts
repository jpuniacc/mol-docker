import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type EstadoRetencionApi = {
  ok: true
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  firmaCompletada: boolean
  buyOrderMatricula: string | null
  buyOrderArancel: string | null
}

const TIMEOUT_MS = 30_000

export async function obtenerEstadoRetencion(input: {
  rut: string
  codcli: string
  anio: number
  semestre: 1 | 2
}): Promise<EstadoRetencionApi | null> {
  const base = admisionApiBaseUrl()
  const q = new URLSearchParams({
    rut: input.rut,
    codcli: input.codcli,
    anio: String(input.anio),
    semestre: String(input.semestre),
  })
  const url = `${base}/api/rematricula/alumno/retencion/estado?${q}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    const body = (await res.json()) as Record<string, unknown>
    if (!res.ok || body.ok !== true) return null
    return {
      ok: true,
      matriculaAutorizada: body.matriculaAutorizada === true,
      arancelAutorizado: body.arancelAutorizado === true,
      firmaCompletada: body.firmaCompletada === true,
      buyOrderMatricula:
        typeof body.buyOrderMatricula === 'string' ? body.buyOrderMatricula : null,
      buyOrderArancel: typeof body.buyOrderArancel === 'string' ? body.buyOrderArancel : null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
