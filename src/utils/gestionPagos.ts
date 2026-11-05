export type FilaGestionPagos = {
  codcli: string
  rut: string
  nombre: string
  carrera: string
  telefono: string
  email: string
  fechaPagoMatricula: string | null
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

const HEADER = [
  'RUT',
  'Nombre',
  'Codcli',
  'Carrera',
  'Teléfono',
  'Email',
  'Fecha pago matrícula',
] as const

function escapeCsv(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function filasGestionPagosACsv(filas: FilaGestionPagos[]): string {
  const lines = [HEADER.join(',')]
  for (const f of filas) {
    lines.push(
      [
        f.rut,
        f.nombre,
        f.codcli,
        f.carrera,
        f.telefono,
        f.email,
        f.fechaPagoMatricula ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function filasGestionPagosAMatriz(filas: FilaGestionPagos[]): (string | number)[][] {
  const out: (string | number)[][] = [Array.from(HEADER)]
  for (const f of filas) {
    out.push([
      f.rut,
      f.nombre,
      f.codcli,
      f.carrera,
      f.telefono,
      f.email,
      f.fechaPagoMatricula ?? '',
    ])
  }
  return out
}
