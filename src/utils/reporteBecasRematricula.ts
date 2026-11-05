import { CODIGO_TALENTO_PRESENCIAL, omiteTopeInternas } from '@/utils/prelacionArancel'
import { disminuirArt13, exigeMedicionPromedio } from '@/utils/resolucionBecaPromedio'

export type ResultadoArt13Reporte =
  | 'MANTIENE'
  | 'BAJA'
  | 'PIERDE'
  | 'SIN_PROMEDIO'
  | 'NO_APLICA'

export type BecaGrabadaReporte = {
  codben: string | null
  descripcion: string
  porc: number | null
  monto: number
  flujo: string | null
  concepto: string | null
  renovable: string | null
  exige_promedio: boolean
  omite_tope_70: boolean
}

export type FilaReporteBecasRematricula = {
  codcli: string
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  codigo_carrera: string | null
  nombre_carrera: string | null
  fec_mat: string | null
  prom_anio: number | null
  cantidad_becas: number
  monto_becas: number
  tiene_exige_promedio: boolean
  resultado_art13: ResultadoArt13Reporte
  becas: BecaGrabadaReporte[]
}

export type KpiReporteBecasRematricula = {
  matriculados_mol: number
  con_beca: number
  sin_beca: number
  monto_becas: number
  art13_mantiene: number
  art13_baja: number
  art13_pierde: number
  art13_sin_promedio: number
  art13_no_aplica: number
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (v == null ? null : String(v))

export const ETIQUETA_ART13: Record<ResultadoArt13Reporte, string> = {
  MANTIENE: 'Mantiene',
  BAJA: 'Baja %',
  PIERDE: 'Pierde',
  SIN_PROMEDIO: 'Sin promedio',
  NO_APLICA: 'No aplica',
}

const ORDEN_ART13: Record<ResultadoArt13Reporte, number> = {
  PIERDE: 0,
  BAJA: 1,
  SIN_PROMEDIO: 2,
  MANTIENE: 3,
  NO_APLICA: 4,
}

/** Peor resultado Art. 13 del alumno (misma nota para todas las becas que miden). */
export function resultadoArt13Alumno(input: {
  promAnio: number | null
  becasExigenPromedio: boolean
}): ResultadoArt13Reporte {
  if (!input.becasExigenPromedio) return 'NO_APLICA'
  if (input.promAnio == null || !(input.promAnio > 0)) return 'SIN_PROMEDIO'
  const t = disminuirArt13(input.promAnio)
  return t.resultado
}

export function peorResultadoArt13(a: ResultadoArt13Reporte, b: ResultadoArt13Reporte): ResultadoArt13Reporte {
  return ORDEN_ART13[a] <= ORDEN_ART13[b] ? a : b
}

export function parseBecaGrabada(raw: unknown): BecaGrabadaReporte | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codben = str(r.codben)?.trim() || null
  const porc = num(r.porc)
  const exige =
    typeof r.exige_promedio === 'boolean'
      ? r.exige_promedio
      : exigeMedicionPromedio(str(r.renovable))
  const omite =
    typeof r.omite_tope_70 === 'boolean'
      ? r.omite_tope_70
      : omiteTopeInternas(codben ?? CODIGO_TALENTO_PRESENCIAL, porc ?? 0)
  return {
    codben,
    descripcion: str(r.descripcion)?.trim() || codben || '—',
    porc,
    monto: num(r.monto) ?? 0,
    flujo: str(r.flujo),
    concepto: str(r.concepto),
    renovable: str(r.renovable),
    exige_promedio: exige,
    omite_tope_70: omite,
  }
}

export function normalizarResultadoArt13(v: unknown): ResultadoArt13Reporte {
  const s = String(v ?? '').toUpperCase()
  if (s === 'MANTIENE' || s === 'BAJA' || s === 'PIERDE' || s === 'SIN_PROMEDIO' || s === 'NO_APLICA') {
    return s
  }
  return 'NO_APLICA'
}

export function parseFilaReporteBecas(raw: unknown): FilaReporteBecasRematricula | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codcli = String(r.codcli ?? '').trim()
  if (!codcli) return null
  const becasRaw = Array.isArray(r.becas) ? r.becas : []
  const becas: BecaGrabadaReporte[] = []
  for (const b of becasRaw) {
    const p = parseBecaGrabada(b)
    if (p) becas.push(p)
  }
  const tieneExige =
    typeof r.tiene_exige_promedio === 'boolean'
      ? r.tiene_exige_promedio
      : becas.some((b) => b.exige_promedio)
  const prom = num(r.prom_anio)
  return {
    codcli,
    rut: str(r.rut),
    rut_norm: str(r.rut_norm),
    nombre_alumno: str(r.nombre_alumno),
    codigo_carrera: str(r.codigo_carrera),
    nombre_carrera: str(r.nombre_carrera),
    fec_mat: str(r.fec_mat),
    prom_anio: prom,
    cantidad_becas: num(r.cantidad_becas) ?? becas.length,
    monto_becas: num(r.monto_becas) ?? becas.reduce((s, b) => s + b.monto, 0),
    tiene_exige_promedio: tieneExige,
    resultado_art13: r.resultado_art13
      ? normalizarResultadoArt13(r.resultado_art13)
      : resultadoArt13Alumno({ promAnio: prom, becasExigenPromedio: tieneExige }),
    becas,
  }
}

export function parseKpiReporteBecas(raw: unknown): KpiReporteBecasRematricula {
  const row = Array.isArray(raw) ? raw[0] : raw
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
  const n = (k: string) => Number(r[k] ?? 0) || 0
  return {
    matriculados_mol: n('matriculados_mol'),
    con_beca: n('con_beca'),
    sin_beca: n('sin_beca'),
    monto_becas: n('monto_becas'),
    art13_mantiene: n('art13_mantiene'),
    art13_baja: n('art13_baja'),
    art13_pierde: n('art13_pierde'),
    art13_sin_promedio: n('art13_sin_promedio'),
    art13_no_aplica: n('art13_no_aplica'),
  }
}

export type FiltroChipBecas =
  | 'todos'
  | 'con_beca'
  | 'sin_beca'
  | 'MANTIENE'
  | 'BAJA'
  | 'PIERDE'
  | 'SIN_PROMEDIO'

export function aplicaChipBecas(f: FilaReporteBecasRematricula, chip: FiltroChipBecas): boolean {
  if (chip === 'todos') return true
  if (chip === 'con_beca') return f.cantidad_becas > 0
  if (chip === 'sin_beca') return f.cantidad_becas === 0
  return f.resultado_art13 === chip
}

export function filasBecasAMatriz(filas: FilaReporteBecasRematricula[]): (string | number)[][] {
  const rows: (string | number)[][] = [[
    'codcli', 'rut', 'nombre', 'carrera', 'prom_anio', 'cantidad_becas', 'monto_becas',
    'resultado_art13', 'becas', 'omite_tope_70', 'fecha_matricula',
  ]]
  for (const f of filas) {
    const omite = f.becas.some((b) => b.omite_tope_70) ? 'si' : ''
    const becasTxt = f.becas
      .map((b) => `${b.codben ?? ''} ${b.descripcion} ${b.porc ?? ''}% $${b.monto}`)
      .join(' | ')
    rows.push([
      f.codcli, f.rut ?? '', f.nombre_alumno ?? '', f.nombre_carrera ?? '',
      f.prom_anio ?? '', f.cantidad_becas, f.monto_becas,
      ETIQUETA_ART13[f.resultado_art13], becasTxt, omite, f.fec_mat ?? '',
    ])
  }
  return rows
}

function csvEscape(value: string): string {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function filasBecasACsv(filas: FilaReporteBecasRematricula[]): string {
  return filasBecasAMatriz(filas)
    .map((r) => r.map((c) => csvEscape(String(c))).join(','))
    .join('\n')
}
