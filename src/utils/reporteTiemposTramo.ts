export type TramoEmbudoId =
  | 'ingreso_tyc'
  | 'tyc_datos'
  | 'datos_forma_pago'
  | 'forma_pago_firma'
  | 'firma_matriculado'

export type FilaTiempoTramo = {
  tramo: TramoEmbudoId
  orden: number
  n: number
  media_horas: number | null
  mediana_horas: number | null
}

export const ETIQUETA_TRAMO: Record<TramoEmbudoId, string> = {
  ingreso_tyc: 'Ingreso → TyC',
  tyc_datos: 'TyC → Datos',
  datos_forma_pago: 'Datos → Forma de pago',
  forma_pago_firma: 'Forma de pago → Firma',
  firma_matriculado: 'Firma → Matriculado',
}

const TRAMOS_OK = new Set<string>(Object.keys(ETIQUETA_TRAMO))

export function parseFilaTiempoTramo(raw: unknown): FilaTiempoTramo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const tramo = String(r.tramo ?? '')
  if (!TRAMOS_OK.has(tramo)) return null
  const n = Number(r.n ?? 0) || 0
  const media = r.media_horas == null || r.media_horas === '' ? null : Number(r.media_horas)
  const mediana = r.mediana_horas == null || r.mediana_horas === '' ? null : Number(r.mediana_horas)
  return {
    tramo: tramo as TramoEmbudoId,
    orden: Number(r.orden ?? 0) || 0,
    n,
    media_horas: media != null && Number.isFinite(media) ? media : null,
    mediana_horas: mediana != null && Number.isFinite(mediana) ? mediana : null,
  }
}

export function parseKpiTiemposTramo(raw: unknown): FilaTiempoTramo[] {
  const rows = Array.isArray(raw) ? raw : []
  const out: FilaTiempoTramo[] = []
  for (const row of rows) {
    const p = parseFilaTiempoTramo(row)
    if (p) out.push(p)
  }
  return out.sort((a, b) => a.orden - b.orden)
}

/** Tramo con mayor mediana (n > 0). */
export function cuelloBotella(filas: FilaTiempoTramo[]): FilaTiempoTramo | null {
  let best: FilaTiempoTramo | null = null
  for (const f of filas) {
    if (f.n <= 0 || f.mediana_horas == null) continue
    if (!best || (best.mediana_horas ?? -1) < f.mediana_horas) best = f
  }
  return best
}

export function fmtHoras(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1).replace(/\.0$/, '')} h`
  return `${(h / 24).toFixed(1).replace(/\.0$/, '')} d`
}
