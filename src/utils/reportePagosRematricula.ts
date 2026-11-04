export type CanalReportePagos = 'MOL' | 'BO'

export type FilaReportePagosRematricula = {
  codcli: string
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  codigo_carrera: string | null
  nombre_carrera: string | null
  canal: CanalReportePagos
  pago_matricula: boolean
  monto_matricula: number | null
  fecha_matricula: string | null
  buy_order_matricula: string | null
  pago_arancel: boolean
  monto_arancel: number | null
  fecha_arancel: string | null
  buy_order_arancel: string | null
}

export type KpiReportePagosRematricula = {
  matriculados_total: number
  matriculados_mol: number
  matriculados_bo: number
  webpay_matricula_alumnos: number
  webpay_matricula_monto: number
  webpay_arancel_alumnos: number
  webpay_arancel_monto: number
  mol_sin_webpay_matricula: number
}

export function parseFilaReportePagos(raw: unknown): FilaReportePagosRematricula | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const canal = String(r.canal ?? '').toUpperCase()
  if (canal !== 'MOL' && canal !== 'BO') return null
  const codcli = String(r.codcli ?? '').trim()
  if (!codcli) return null
  return {
    codcli,
    rut: r.rut == null ? null : String(r.rut),
    rut_norm: r.rut_norm == null ? null : String(r.rut_norm),
    nombre_alumno: r.nombre_alumno == null ? null : String(r.nombre_alumno),
    codigo_carrera: r.codigo_carrera == null ? null : String(r.codigo_carrera),
    nombre_carrera: r.nombre_carrera == null ? null : String(r.nombre_carrera),
    canal,
    pago_matricula: r.pago_matricula === true,
    monto_matricula: r.monto_matricula == null ? null : Number(r.monto_matricula),
    fecha_matricula: r.fecha_matricula == null ? null : String(r.fecha_matricula),
    buy_order_matricula: r.buy_order_matricula == null ? null : String(r.buy_order_matricula),
    pago_arancel: r.pago_arancel === true,
    monto_arancel: r.monto_arancel == null ? null : Number(r.monto_arancel),
    fecha_arancel: r.fecha_arancel == null ? null : String(r.fecha_arancel),
    buy_order_arancel: r.buy_order_arancel == null ? null : String(r.buy_order_arancel),
  }
}

export function parseKpiReportePagos(raw: unknown): KpiReportePagosRematricula {
  const row = Array.isArray(raw) ? raw[0] : raw
  const r =
    row && typeof row === 'object' ? (row as Record<string, unknown>) : ({} as Record<string, unknown>)
  return {
    matriculados_total: Number(r.matriculados_total ?? 0) || 0,
    matriculados_mol: Number(r.matriculados_mol ?? 0) || 0,
    matriculados_bo: Number(r.matriculados_bo ?? 0) || 0,
    webpay_matricula_alumnos: Number(r.webpay_matricula_alumnos ?? 0) || 0,
    webpay_matricula_monto: Number(r.webpay_matricula_monto ?? 0) || 0,
    webpay_arancel_alumnos: Number(r.webpay_arancel_alumnos ?? 0) || 0,
    webpay_arancel_monto: Number(r.webpay_arancel_monto ?? 0) || 0,
    mol_sin_webpay_matricula: Number(r.mol_sin_webpay_matricula ?? 0) || 0,
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function filasReportePagosACsv(filas: FilaReportePagosRematricula[]): string {
  const header = [
    'codcli',
    'rut',
    'nombre',
    'carrera',
    'canal',
    'pago_matricula',
    'monto_matricula',
    'fecha_matricula',
    'buy_order_matricula',
    'pago_arancel',
    'monto_arancel',
    'fecha_arancel',
    'buy_order_arancel',
  ]
  const lines = [header.join(',')]
  for (const f of filas) {
    lines.push(
      [
        f.codcli,
        f.rut ?? '',
        f.nombre_alumno ?? '',
        f.nombre_carrera ?? '',
        f.canal,
        f.pago_matricula ? 'si' : 'no',
        f.monto_matricula == null ? '' : String(f.monto_matricula),
        f.fecha_matricula ?? '',
        f.buy_order_matricula ?? '',
        f.pago_arancel ? 'si' : 'no',
        f.monto_arancel == null ? '' : String(f.monto_arancel),
        f.fecha_arancel ?? '',
        f.buy_order_arancel ?? '',
      ]
        .map((c) => csvEscape(c))
        .join(','),
    )
  }
  return lines.join('\n')
}
