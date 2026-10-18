import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type NpsRematriculaAdminFila = {
  id: string
  creadoEn: string
  rut: string | null
  codcli: string
  codigoCarrera: string
  jornada: string
  calificacion: number
  comentario: string | null
}

export type NpsRematriculaAdminListado = {
  ok: true
  anio: number
  semestre: number
  totalRespuestas: number
  totalFinalizados: number
  filas: NpsRematriculaAdminFila[]
}

export async function listarNpsRematriculaAdmin(
  anio: number,
  semestre: number,
): Promise<NpsRematriculaAdminListado | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const params = new URLSearchParams({
      anio: String(anio),
      semestre: String(semestre),
    })
    const destino = urlConCarteraEjecutivo(
      `${admisionApiBaseUrl()}/api/rematricula/nps?${params.toString()}`,
    )
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, {
      signal: controller.signal,
    })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al leer el NPS` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const rec = body as Partial<NpsRematriculaAdminListado>
    if (!rec.ok || !Array.isArray(rec.filas)) {
      return { ok: false, error: 'La respuesta del NPS no tiene el formato esperado' }
    }
    return {
      ok: true,
      anio: Number(rec.anio),
      semestre: Number(rec.semestre),
      totalRespuestas: Number(rec.totalRespuestas ?? rec.filas.length),
      totalFinalizados: Number(rec.totalFinalizados ?? 0),
      filas: rec.filas,
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al leer el NPS' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer el NPS' }
  } finally {
    clearTimeout(timer)
  }
}
