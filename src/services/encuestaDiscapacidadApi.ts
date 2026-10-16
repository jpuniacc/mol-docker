import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type EncuestaDiscapacidadFila = {
  id: string
  creadoEn: string
  contesta: boolean
  tipoSupabase: string | null
  afirmaciones: string[]
  rut: string | null
  codcli: string | null
  nombre: string | null
  anio: number | null
  semestre: number | null
  periodoLabel: string | null
  esMock: boolean
  discapacidadErp: string | null
  coincide: boolean | null
}

export type EncuestaDiscapacidadListado = {
  ok: true
  ambiente: 'test' | 'prod'
  erpOk: boolean
  erpError: string | null
  filas: EncuestaDiscapacidadFila[]
}

export async function listarEncuestaDiscapacidad(): Promise<
  EncuestaDiscapacidadListado | { ok: false; error: string }
> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/discapacidad/encuesta`)
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, {
      signal: controller.signal,
    })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al leer la encuesta` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const rec = body as Partial<EncuestaDiscapacidadListado>
    if (!rec.ok || !Array.isArray(rec.filas)) {
      return { ok: false, error: 'La respuesta de la encuesta no tiene el formato esperado' }
    }
    return {
      ok: true,
      ambiente: rec.ambiente === 'test' ? 'test' : 'prod',
      erpOk: rec.erpOk !== false,
      erpError: rec.erpError ?? null,
      filas: rec.filas,
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al leer la encuesta' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer la encuesta' }
  } finally {
    clearTimeout(timer)
  }
}
