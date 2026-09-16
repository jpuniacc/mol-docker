export type ArancelFallbackAnoParams = {
  ano?: number
  anoSolicitado?: number
  fallbackAno?: number
}

/** Texto de UI cuando el SP usó 2026 porque no había tarifa 2027. */
export function etiquetaFallbackArancelAno(
  params?: ArancelFallbackAnoParams,
): string | null {
  const solicitado = params?.anoSolicitado
  const usado = params?.fallbackAno
  if (solicitado == null || usado == null) return null
  return `Arancel ${usado} (no hay tarifa ${solicitado})`
}
