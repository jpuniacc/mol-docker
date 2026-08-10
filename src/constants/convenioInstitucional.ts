/** Ofertas de la matriz de descuentos (Excel Convenios). */
export const CONVENIO_OFERTAS = [
  { codigo: 'PREGRADO_DIURNO', label: 'Pregrado Diurno', excelHeader: 'Pregrado Diurno' },
  { codigo: 'PREGRADO_VESPERTINO', label: 'Pregrado Vespertino', excelHeader: 'Pregrado Vespertino' },
  { codigo: 'PREGRADO_ONLINE', label: 'Pregrado Online', excelHeader: 'Pregrado Online' },
  { codigo: 'PREGRADO_ADVANCE', label: 'Pregrado Advance', excelHeader: 'Preegrado Advance' },
  {
    codigo: 'PREGRADO_SEMIPRESENCIAL',
    label: 'Pregrado Semipresencial',
    excelHeader: 'Pregrado Semipresencial',
  },
  { codigo: 'LICENCIATURA', label: 'Licenciatura', excelHeader: 'Licenciatura' },
  { codigo: 'MAGISTER', label: 'Magíster', excelHeader: 'Magister' },
  { codigo: 'DIPLOMADOS', label: 'Diplomados', excelHeader: 'Diplomados' },
] as const

export type ConvenioOfertaCodigo = (typeof CONVENIO_OFERTAS)[number]['codigo']

export const CONVENIO_ESTADOS = ['VIGENTE', 'EN_TRAMITE', 'NO_VIGENTE'] as const
export type ConvenioEstado = (typeof CONVENIO_ESTADOS)[number]

export function periodoLabel(anio: number, semestre: number): string {
  return `${anio}-${semestre}`
}

export function parsePeriodoLabel(label: string): { anio: number; semestre: number } | null {
  const m = label.trim().match(/^(\d{4})-([12])$/)
  if (!m) return null
  return { anio: Number(m[1]), semestre: Number(m[2]) as 1 | 2 }
}
