/** Periodo del catálogo de beneficios: `YYYY-0S` (ej. 2027-01). */
export function periodoCatalogoLabel(anio: number, semestre: number): string {
  const s = Number(semestre)
  const sufijo = s === 1 ? '01' : s === 2 ? '02' : String(s).padStart(2, '0')
  return `${Number(anio)}-${sufijo}`
}

/**
 * Clave comparable entre formatos de periodo usados en MOL:
 * `2027-1` (periodo activo), `2027-01` (catálogo), `2027/1` (legacy contrato).
 */
export function periodoComparableKey(periodo: string | null | undefined): string | null {
  if (periodo == null) return null
  const raw = String(periodo).trim()
  if (!raw) return null
  const m = raw.match(/^(\d{4})\s*[-\/]\s*(\d{1,2})$/)
  if (!m) return raw.toLowerCase()
  return `${Number(m[1])}-${Number(m[2])}`
}

export function periodosEquivalentes(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = periodoComparableKey(a)
  const kb = periodoComparableKey(b)
  if (ka == null || kb == null) return false
  return ka === kb
}
