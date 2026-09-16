/** Periodo del catálogo de beneficios: `YYYY-0S` (ej. 2027-01). */
export function periodoCatalogoLabel(anio: number, semestre: number): string {
  const s = Number(semestre)
  const sufijo = s === 1 ? '01' : s === 2 ? '02' : String(s).padStart(2, '0')
  return `${Number(anio)}-${sufijo}`
}
