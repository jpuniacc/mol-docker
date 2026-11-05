import type {
  ContratoFirmaFirmanteEstado,
  ContratoFirmaListRow,
  MedioFirmaArancel,
  MedioFirmaMatricula,
} from '@/services/contratoFirmaApi'

export type FiltroEstadoFirma = 'todos' | 'pendiente' | 'firmado'
export type FiltroAntiguedadFirma = 'todas' | '48h'
export type FiltroMedioFirma = 'todos' | 'webpay' | 'pagare' | 'cubierto'

export type ResumenGestionFirmas = {
  enviados: number
  firmados: number
  pendientes: number
  pendientes48h: number
  faltaAlumno: number
  faltaSostenedor: number
}

const MS_48H = 48 * 60 * 60 * 1000

export function horasDesdeGenerado(
  createdAt: string | null | undefined,
  ahora: Date = new Date(),
): number | null {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  const ms = ahora.getTime() - d.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (60 * 60 * 1000))
}

export function esPendiente48h(row: ContratoFirmaListRow, ahora: Date = new Date()): boolean {
  if (row.ready) return false
  const d = new Date(row.created_at)
  if (Number.isNaN(d.getTime())) return false
  return ahora.getTime() - d.getTime() > MS_48H
}

export function etiquetaHoras(horas: number | null): string {
  if (horas == null) return '—'
  if (horas < 1) return '<1 h'
  return `${horas} h`
}

export function firmantesPendientes(
  firmantes: ContratoFirmaFirmanteEstado[] | undefined,
): ContratoFirmaFirmanteEstado[] {
  return (firmantes ?? []).filter((f) => !f.ready)
}

export function etiquetaRolCorto(rol: ContratoFirmaFirmanteEstado['rol']): string {
  return rol === 'apoderado' ? 'Sost.' : 'Alumno'
}

export function resumirGestionFirmas(
  filas: ContratoFirmaListRow[],
  ahora: Date = new Date(),
): ResumenGestionFirmas {
  let firmados = 0
  let pendientes = 0
  let pendientes48h = 0
  let faltaAlumno = 0
  let faltaSostenedor = 0
  for (const row of filas) {
    if (row.ready) {
      firmados += 1
      continue
    }
    pendientes += 1
    if (esPendiente48h(row, ahora)) pendientes48h += 1
    for (const f of firmantesPendientes(row.firmantes)) {
      if (f.rol === 'alumno') faltaAlumno += 1
      if (f.rol === 'apoderado') faltaSostenedor += 1
    }
  }
  return {
    enviados: filas.length,
    firmados,
    pendientes,
    pendientes48h,
    faltaAlumno,
    faltaSostenedor,
  }
}

function medioCoincide(
  row: ContratoFirmaListRow,
  medio: FiltroMedioFirma,
): boolean {
  if (medio === 'todos') return true
  return row.medio_matricula === medio || row.medio_arancel === medio
}

export function aplicaFiltrosFirma(
  row: ContratoFirmaListRow,
  opts: {
    estado: FiltroEstadoFirma
    busqueda: string
    carrera: string
    medio: FiltroMedioFirma
    antiguedad: FiltroAntiguedadFirma
    ahora?: Date
  },
): boolean {
  if (opts.estado === 'pendiente' && row.ready) return false
  if (opts.estado === 'firmado' && !row.ready) return false
  const q = opts.busqueda.trim().toLowerCase()
  if (q) {
    const hay =
      (row.rut ?? '').toLowerCase().includes(q) ||
      (row.nombre ?? '').toLowerCase().includes(q) ||
      (row.codcli ?? '').toLowerCase().includes(q) ||
      row.num_operacion.toLowerCase().includes(q)
    if (!hay) return false
  }
  if (opts.carrera && (row.carrera ?? '') !== opts.carrera) return false
  if (!medioCoincide(row, opts.medio)) return false
  if (opts.antiguedad === '48h' && !esPendiente48h(row, opts.ahora ?? new Date())) return false
  return true
}

export function etiquetaMedioFirma(
  medio: MedioFirmaMatricula | MedioFirmaArancel | undefined,
): string {
  if (medio === 'webpay') return 'Webpay'
  if (medio === 'pagare') return 'Pagaré'
  if (medio === 'cubierto') return 'Cubierto'
  return '—'
}

/** Serie diaria enviados / firmados (proxy: firmados ready agrupados por created_at). */
export function serieDiariaFirmas(
  filas: ContratoFirmaListRow[],
  dias: number,
  ahora: Date = new Date(),
): Array<{ dia: string; enviados: number; firmados: number }> {
  const out: Array<{ dia: string; enviados: number; firmados: number }> = []
  const map = new Map<string, { enviados: number; firmados: number }>()
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(ahora)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    map.set(key, { enviados: 0, firmados: 0 })
    const label = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ dia: label, enviados: 0, firmados: 0 })
  }
  const keys = [...map.keys()]
  for (const row of filas) {
    const d = new Date(row.created_at)
    if (Number.isNaN(d.getTime())) continue
    const key = new Date(d)
    key.setHours(0, 0, 0, 0)
    const iso = key.toISOString().slice(0, 10)
    const bucket = map.get(iso)
    if (!bucket) continue
    bucket.enviados += 1
    if (row.ready) bucket.firmados += 1
  }
  return keys.map((k, i) => {
    const b = map.get(k)!
    return { dia: out[i]!.dia, enviados: b.enviados, firmados: b.firmados }
  })
}

const HEADER = [
  'N° operación',
  'RUT',
  'Nombre',
  'Codcli',
  'Carrera',
  'Medio matrícula',
  'Medio arancel',
  'Estado',
  'Quién falta',
  'Generado',
  'Horas',
] as const

function escapeCsv(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function filasGestionFirmasACsv(
  filas: ContratoFirmaListRow[],
  ahora: Date = new Date(),
): string {
  const lines = [HEADER.join(',')]
  for (const f of filas) {
    const falta = firmantesPendientes(f.firmantes)
      .map((x) => etiquetaRolCorto(x.rol))
      .join('|')
    lines.push(
      [
        f.num_operacion,
        f.rut ?? '',
        f.nombre ?? '',
        f.codcli ?? '',
        f.carrera ?? '',
        etiquetaMedioFirma(f.medio_matricula),
        etiquetaMedioFirma(f.medio_arancel),
        f.ready ? 'Firmado' : 'Pendiente',
        falta,
        f.created_at,
        String(horasDesdeGenerado(f.created_at, ahora) ?? ''),
      ]
        .map(escapeCsv)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function filasGestionFirmasAMatriz(
  filas: ContratoFirmaListRow[],
  ahora: Date = new Date(),
): (string | number)[][] {
  const out: (string | number)[][] = [Array.from(HEADER)]
  for (const f of filas) {
    const falta = firmantesPendientes(f.firmantes)
      .map((x) => etiquetaRolCorto(x.rol))
      .join('|')
    out.push([
      f.num_operacion,
      f.rut ?? '',
      f.nombre ?? '',
      f.codcli ?? '',
      f.carrera ?? '',
      etiquetaMedioFirma(f.medio_matricula),
      etiquetaMedioFirma(f.medio_arancel),
      f.ready ? 'Firmado' : 'Pendiente',
      falta,
      f.created_at,
      horasDesdeGenerado(f.created_at, ahora) ?? '',
    ])
  }
  return out
}
