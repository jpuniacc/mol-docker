import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'
import { parseFilaGestionPagos, type FilaGestionPagos } from '@/utils/gestionPagos'

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
      return { ok: false, error: 'Tiempo de espera agotado al consultar Gestión Pagos' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}

export async function listarGestionPagos(
  anio: number,
  semestre: number,
): Promise<{ data: FilaGestionPagos[]; error: string | null }> {
  const params = new URLSearchParams({
    anio: String(anio),
    semestre: String(semestre),
  })
  const r = await getJson(`/api/rematricula/reportes/gestion-pagos?${params.toString()}`)
  if (!r.ok) return { data: [], error: r.error }
  const body = r.body as { filas?: unknown[] }
  const data: FilaGestionPagos[] = []
  for (const row of Array.isArray(body.filas) ? body.filas : []) {
    const parsed = parseFilaGestionPagos(row)
    if (parsed) data.push(parsed)
  }
  return { data, error: null }
}
