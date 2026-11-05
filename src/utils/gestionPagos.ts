export type FilaGestionPagos = {
  codcli: string
  rut: string
  nombre: string
  carrera: string
  telefono: string
  email: string
  fechaPagoMatricula: string | null
}

/** Buckets de antigüedad desde pago matrícula (días calendario). */
export type BucketAntiguedad = '0-2' | '3-7' | '7+'

export type FiltroAntiguedad = 'todas' | BucketAntiguedad

export type ResumenAntiguedad = {
  total: number
  d0_2: number
  d3_7: number
  d7: number
}

function texto(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

export function parseFilaGestionPagos(raw: unknown): FilaGestionPagos | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const codcli = texto(r.codcli)
  if (!codcli) return null
  const fechaRaw = r.fecha_pago_matricula ?? r.fechaPagoMatricula
  let fechaPagoMatricula: string | null = null
  if (fechaRaw != null && String(fechaRaw).trim()) {
    fechaPagoMatricula = String(fechaRaw).trim()
  }
  return {
    codcli,
    rut: texto(r.rut),
    nombre: texto(r.nombre_alumno ?? r.nombre),
    carrera: texto(r.nombre_carrera ?? r.carrera),
    telefono: texto(r.telefono),
    email: texto(r.email),
    fechaPagoMatricula,
  }
}

/** Días enteros desde `fechaIso` hasta `ahora` (floor). Null si fecha inválida. */
export function diasDesdePago(fechaIso: string | null, ahora: Date = new Date()): number | null {
  if (!fechaIso) return null
  const d = new Date(fechaIso)
  if (Number.isNaN(d.getTime())) return null
  const ms = ahora.getTime() - d.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function bucketAntiguedad(dias: number | null): BucketAntiguedad | null {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return null
  if (dias <= 2) return '0-2'
  if (dias <= 7) return '3-7'
  return '7+'
}

export function etiquetaBucket(bucket: BucketAntiguedad): string {
  if (bucket === '0-2') return '0–2 días'
  if (bucket === '3-7') return '3–7 días'
  return 'Más de 7 días'
}

export function etiquetaDias(dias: number | null): string {
  if (dias == null) return '—'
  if (dias === 1) return '1 día'
  return `${dias} días`
}

export function resumirAntiguedad(
  filas: FilaGestionPagos[],
  ahora: Date = new Date(),
): ResumenAntiguedad {
  let d0_2 = 0
  let d3_7 = 0
  let d7 = 0
  for (const f of filas) {
    const b = bucketAntiguedad(diasDesdePago(f.fechaPagoMatricula, ahora))
    if (b === '0-2') d0_2 += 1
    else if (b === '3-7') d3_7 += 1
    else if (b === '7+') d7 += 1
  }
  return { total: filas.length, d0_2, d3_7, d7 }
}

export function aplicaFiltroAntiguedad(
  fila: FilaGestionPagos,
  filtro: FiltroAntiguedad,
  ahora: Date = new Date(),
): boolean {
  if (filtro === 'todas') return true
  return bucketAntiguedad(diasDesdePago(fila.fechaPagoMatricula, ahora)) === filtro
}

/** Agrupa por carrera; top N + Otras. */
export function porCarreraGestionPagos(
  filas: FilaGestionPagos[],
  topN = 6,
): Array<{ carrera: string; n: number }> {
  const map = new Map<string, number>()
  for (const f of filas) {
    const c = f.carrera.trim() || 'Sin carrera'
    map.set(c, (map.get(c) ?? 0) + 1)
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
  if (sorted.length <= topN) {
    return sorted.map(([carrera, n]) => ({ carrera, n }))
  }
  const head = sorted.slice(0, topN - 1).map(([carrera, n]) => ({ carrera, n }))
  const otras = sorted.slice(topN - 1).reduce((s, [, n]) => s + n, 0)
  return [...head, { carrera: 'Otras', n: otras }]
}

/** Normaliza teléfono Chile a dígitos para wa.me (56XXXXXXXXX). */
export function telefonoWhatsAppUrl(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null
  let local = digitos
  if (local.startsWith('56')) local = local.slice(2)
  if (local.startsWith('0')) local = local.slice(1)
  if (local.length !== 9) return null
  return `https://wa.me/56${local}`
}

const HEADER = [
  'RUT',
  'Nombre',
  'Codcli',
  'Carrera',
  'Teléfono',
  'Email',
  'Fecha pago matrícula',
  'Antigüedad (días)',
] as const

function escapeCsv(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function filasGestionPagosACsv(
  filas: FilaGestionPagos[],
  ahora: Date = new Date(),
): string {
  const lines = [HEADER.join(',')]
  for (const f of filas) {
    const dias = diasDesdePago(f.fechaPagoMatricula, ahora)
    lines.push(
      [
        f.rut,
        f.nombre,
        f.codcli,
        f.carrera,
        f.telefono,
        f.email,
        f.fechaPagoMatricula ?? '',
        dias == null ? '' : String(dias),
      ]
        .map(escapeCsv)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function filasGestionPagosAMatriz(
  filas: FilaGestionPagos[],
  ahora: Date = new Date(),
): (string | number)[][] {
  const out: (string | number)[][] = [Array.from(HEADER)]
  for (const f of filas) {
    const dias = diasDesdePago(f.fechaPagoMatricula, ahora)
    out.push([
      f.rut,
      f.nombre,
      f.codcli,
      f.carrera,
      f.telefono,
      f.email,
      f.fechaPagoMatricula ?? '',
      dias == null ? '' : dias,
    ])
  }
  return out
}
