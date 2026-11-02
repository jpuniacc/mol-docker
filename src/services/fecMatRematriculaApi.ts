import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type FecMatRematriculaFila = {
  codcli: string
  rut: string | null
  fecMat: string | null
  horaMat: string | null
}

export type FecMatRematriculaListado = {
  ok: true
  anio: number
  semestre: number
  total: number
  filas: FecMatRematriculaFila[]
}

export function etiquetaFecMat(fila: Pick<FecMatRematriculaFila, 'fecMat' | 'horaMat'> | null | undefined): string {
  if (!fila?.fecMat) return '—'
  const hora = fila.horaMat?.trim()
  if (!hora || hora === '00:00:00') return fila.fecMat
  return `${fila.fecMat} ${hora.slice(0, 5)}`
}

export async function listarFecMatRematricula(
  anio: number,
  semestre: number,
): Promise<FecMatRematriculaListado | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const params = new URLSearchParams({
      anio: String(anio),
      semestre: String(semestre),
    })
    const destino = urlConCarteraEjecutivo(
      `${admisionApiBaseUrl()}/api/rematricula/fec-mat?${params.toString()}`,
    )
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, { signal: controller.signal })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al leer fechas de matrícula` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const data = body as FecMatRematriculaListado
    if (!data?.ok || !Array.isArray(data.filas)) {
      return { ok: false, error: 'Respuesta inválida de fechas de matrícula' }
    }
    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al leer fechas de matrícula' }
    }
    const message = err instanceof Error ? err.message : 'Error de red'
    return { ok: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** Mapa codcli → etiqueta fecha/hora (dd/mm/yyyy hh:mm). */
export function mapaFecMatPorCodcli(filas: FecMatRematriculaFila[]): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const fila of filas) {
    const key = fila.codcli.trim()
    if (!key) continue
    mapa[key] = etiquetaFecMat(fila)
  }
  return mapa
}
