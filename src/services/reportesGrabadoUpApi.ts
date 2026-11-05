import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'
import {
  parseFilaGrabadoUp,
  type DetalleGrabadoUp,
  type FilaGrabadoUp,
  type ResumenGrabadoUp,
  type SemaforoGrabadoUp,
} from '@/utils/reporteGrabadoUp'

function asSemaforo(v: unknown): SemaforoGrabadoUp {
  if (v === 'ok' || v === 'incompleto' || v === 'sin_op') return v
  return 'sin_op'
}

async function getJson(
  pathConQuery: string,
  timeoutMs = 90_000,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}${pathConQuery}`)
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, { signal: controller.signal })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status}` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    return { ok: true, body }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al consultar U+' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}

export async function listarReporteGrabadoUp(
  anio: number,
  semestre: number,
  carrera: string | null = null,
  q: string | null = null,
): Promise<{ data: FilaGrabadoUp[]; resumen: ResumenGrabadoUp | null; error: string | null }> {
  const params = new URLSearchParams({ anio: String(anio), semestre: String(semestre) })
  if (carrera) params.set('carrera', carrera)
  if (q) params.set('q', q)
  const r = await getJson(`/api/rematricula/reportes/grabado-up?${params.toString()}`)
  if (!r.ok) return { data: [], resumen: null, error: r.error }
  const body = r.body as {
    filas?: unknown[]
    resumen?: Partial<ResumenGrabadoUp>
  }
  const filas: FilaGrabadoUp[] = []
  for (const row of Array.isArray(body.filas) ? body.filas : []) {
    const parsed = parseFilaGrabadoUp(row)
    if (parsed) filas.push(parsed)
  }
  const resumen: ResumenGrabadoUp = {
    total: Number(body.resumen?.total ?? filas.length),
    ok: Number(body.resumen?.ok ?? filas.filter((f) => f.semaforo === 'ok').length),
    incompleto: Number(
      body.resumen?.incompleto ?? filas.filter((f) => f.semaforo === 'incompleto').length,
    ),
    sin_op: Number(body.resumen?.sin_op ?? filas.filter((f) => f.semaforo === 'sin_op').length),
  }
  return { data: filas, resumen, error: null }
}

export async function detalleReporteGrabadoUp(input: {
  anio: number
  semestre: number
  numOperacion?: string | null
  rutCodcli?: string | null
}): Promise<{ data: DetalleGrabadoUp | null; error: string | null }> {
  const params = new URLSearchParams({
    anio: String(input.anio),
    semestre: String(input.semestre),
  })
  if (input.numOperacion) params.set('numOperacion', input.numOperacion)
  if (input.rutCodcli) params.set('rutCodcli', input.rutCodcli)
  const r = await getJson(`/api/rematricula/reportes/grabado-up/detalle?${params.toString()}`)
  if (!r.ok) return { data: null, error: r.error }
  const b = r.body as Record<string, unknown>
  return {
    data: {
      anio: Number(b.anio ?? input.anio),
      semestre: Number(b.semestre ?? input.semestre),
      rutCodcli: b.rutCodcli == null ? null : String(b.rutCodcli),
      numOperacion: b.numOperacion == null ? null : String(b.numOperacion),
      semaforo: asSemaforo(b.semaforo),
      control: Array.isArray(b.control) ? (b.control as Record<string, unknown>[]) : [],
      ctapag: Array.isArray(b.ctapag) ? (b.ctapag as Record<string, unknown>[]) : [],
      ctadep: Array.isArray(b.ctadep) ? (b.ctadep as Record<string, unknown>[]) : [],
      ctadoc: Array.isArray(b.ctadoc) ? (b.ctadoc as Record<string, unknown>[]) : [],
      docitem: Array.isArray(b.docitem) ? (b.docitem as Record<string, unknown>[]) : [],
      posben: Array.isArray(b.posben) ? (b.posben as Record<string, unknown>[]) : [],
    },
    error: null,
  }
}
