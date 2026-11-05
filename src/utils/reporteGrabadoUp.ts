export type SemaforoGrabadoUp = 'ok' | 'incompleto' | 'sin_op'
export type FiltroChipGrabadoUp = 'todos' | SemaforoGrabadoUp

export type FilaGrabadoUp = {
  codcli: string
  rut: string | null
  rutNorm: string | null
  rutCodcli: string | null
  nombreAlumno: string | null
  codigoCarrera: string | null
  nombreCarrera: string | null
  fecMat: string | null
  numOperacion: string | null
  controlEstado: string | null
  controlOk: boolean
  tieneCuenta: boolean
  semaforo: SemaforoGrabadoUp
}

export type ResumenGrabadoUp = {
  total: number
  ok: number
  incompleto: number
  sin_op: number
}

export type DetalleGrabadoUp = {
  anio: number
  semestre: number
  rutCodcli: string | null
  numOperacion: string | null
  semaforo: SemaforoGrabadoUp
  control: Record<string, unknown>[]
  ctapag: Record<string, unknown>[]
  ctadep: Record<string, unknown>[]
  ctadoc: Record<string, unknown>[]
  docitem: Record<string, unknown>[]
  posben: Record<string, unknown>[]
}

export const ETIQUETA_SEMAFORO: Record<SemaforoGrabadoUp, string> = {
  ok: 'OK',
  incompleto: 'Incompleto',
  sin_op: 'Sin op',
}

export function aplicaChipGrabadoUp(f: FilaGrabadoUp, chip: FiltroChipGrabadoUp): boolean {
  if (chip === 'todos') return true
  return f.semaforo === chip
}

export function filasGrabadoUpACsv(filas: FilaGrabadoUp[]): string {
  const header = [
    'codcli',
    'rut',
    'nombre',
    'carrera',
    'num_operacion',
    'control',
    'semaforo',
    'fec_mat',
  ]
  const lines = [header.join(';')]
  for (const f of filas) {
    lines.push(
      [
        f.codcli,
        f.rut ?? f.rutNorm ?? '',
        f.nombreAlumno ?? '',
        f.nombreCarrera ?? '',
        f.numOperacion ?? '',
        f.controlEstado ?? '',
        f.semaforo,
        f.fecMat ?? '',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    )
  }
  return lines.join('\n')
}

export function filasGrabadoUpAMatriz(filas: FilaGrabadoUp[]): (string | number)[][] {
  return [
    ['CODCLI', 'RUT', 'Nombre', 'Carrera', 'Op. cuenta', 'Control', 'Semáforo', 'Fecha matrícula'],
    ...filas.map((f) => [
      f.codcli,
      f.rut ?? f.rutNorm ?? '',
      f.nombreAlumno ?? '',
      f.nombreCarrera ?? '',
      f.numOperacion ?? '',
      f.controlEstado ?? '',
      ETIQUETA_SEMAFORO[f.semaforo],
      f.fecMat ?? '',
    ]),
  ]
}

function asSemaforo(v: unknown): SemaforoGrabadoUp {
  if (v === 'ok' || v === 'incompleto' || v === 'sin_op') return v
  return 'sin_op'
}

export function parseFilaGrabadoUp(raw: unknown): FilaGrabadoUp | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codcli = String(r.codcli ?? '').trim()
  if (!codcli) return null
  return {
    codcli,
    rut: r.rut == null ? null : String(r.rut),
    rutNorm: r.rutNorm == null && r.rut_norm == null ? null : String(r.rutNorm ?? r.rut_norm),
    rutCodcli: r.rutCodcli == null && r.rut_codcli == null ? null : String(r.rutCodcli ?? r.rut_codcli),
    nombreAlumno:
      r.nombreAlumno == null && r.nombre_alumno == null
        ? null
        : String(r.nombreAlumno ?? r.nombre_alumno),
    codigoCarrera:
      r.codigoCarrera == null && r.codigo_carrera == null
        ? null
        : String(r.codigoCarrera ?? r.codigo_carrera),
    nombreCarrera:
      r.nombreCarrera == null && r.nombre_carrera == null
        ? null
        : String(r.nombreCarrera ?? r.nombre_carrera),
    fecMat: r.fecMat == null && r.fec_mat == null ? null : String(r.fecMat ?? r.fec_mat),
    numOperacion:
      r.numOperacion == null && r.num_operacion == null
        ? null
        : String(r.numOperacion ?? r.num_operacion),
    controlEstado:
      r.controlEstado == null && r.control_estado == null
        ? null
        : String(r.controlEstado ?? r.control_estado),
    controlOk: Boolean(r.controlOk ?? r.control_ok),
    tieneCuenta: Boolean(r.tieneCuenta ?? r.tiene_cuenta),
    semaforo: asSemaforo(r.semaforo),
  }
}
