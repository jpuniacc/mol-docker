export function normalizarNombreBeca(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function esSinBeca(nombre: string | null | undefined): boolean {
  const n = normalizarNombreBeca(nombre)
  return !n || n === 'sin beca' || n === '-' || n === 'n/a'
}

export function matchCodBeneficio(
  nombreExcel: string | null | undefined,
  catalogo: { codigo_beneficio: string; beneficio: string }[],
): string | null {
  if (esSinBeca(nombreExcel)) return null
  const target = normalizarNombreBeca(nombreExcel)
  const hit = catalogo.find((c) => normalizarNombreBeca(c.beneficio) === target)
  return hit?.codigo_beneficio?.trim() || null
}
