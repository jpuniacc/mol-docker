export type CalificacionNps = 1 | 2 | 3 | 4 | 5 | 6 | 7

export function esCalificacionNps(n: number): n is CalificacionNps {
  return Number.isInteger(n) && n >= 1 && n <= 7
}

export function normalizarComentarioNps(
  calificacion: CalificacionNps,
  comentario: string | null | undefined,
): string | null {
  if (calificacion >= 5) return null
  const t = (comentario ?? '').trim()
  if (!t) return null
  return t.length > 500 ? t.slice(0, 500) : t
}

export function promedioNps(calificaciones: CalificacionNps[]): number | null {
  if (calificaciones.length === 0) return null
  const sum = calificaciones.reduce((a, b) => a + b, 0)
  return sum / calificaciones.length
}

export function distribucionNps(
  calificaciones: CalificacionNps[],
): Record<CalificacionNps, number> {
  const out: Record<CalificacionNps, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  for (const c of calificaciones) out[c] += 1
  return out
}

export function tasaRespuestaNps(respuestas: number, finalizados: number): number | null {
  if (finalizados <= 0) return null
  return respuestas / finalizados
}
