/** Día de vencimiento permitido en pagaré MOL. */
export type PagareDiaVencimiento = 5 | 15 | 25

function hoyIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Mes 1-based de la primera cuota según periodo académico:
 * - semestre 1 → marzo (3)
 * - semestre 2 → agosto (8)
 */
export function mesPrimeraCuotaPeriodo(semestrePeriodo: number | null): 3 | 8 | null {
  if (semestrePeriodo === 1) return 3
  if (semestrePeriodo === 2) return 8
  return null
}

/**
 * Día D del mes siguiente a `desde` (siempre mes+1).
 */
export function proximaFechaDiaVencimiento(
  dia: PagareDiaVencimiento,
  desde = new Date(),
): string {
  const candidato = new Date(desde.getFullYear(), desde.getMonth() + 1, dia)
  return hoyIsoLocal(candidato)
}

/**
 * Fecha de inicio del pagaré (primera cuota).
 * Periodo 1 → marzo del año del periodo; periodo 2 → agosto.
 * Si esa fecha ya pasó respecto de `hoy`, usa el próximo día D (mes siguiente a hoy).
 */
export function fechaInicioPagarePeriodo(opts: {
  dia: PagareDiaVencimiento
  anioPeriodo: number | null
  semestrePeriodo: number | null
  hoy?: Date
}): string {
  const hoy = opts.hoy ?? new Date()
  const hoyIso = hoyIsoLocal(hoy)
  const mes = mesPrimeraCuotaPeriodo(opts.semestrePeriodo)
  if (opts.anioPeriodo != null && mes != null) {
    const candidato = hoyIsoLocal(new Date(opts.anioPeriodo, mes - 1, opts.dia))
    if (candidato >= hoyIso) return candidato
  }
  return proximaFechaDiaVencimiento(opts.dia, hoy)
}

export function etiquetaMesPrimeraCuota(
  anioPeriodo: number | null,
  semestrePeriodo: number | null,
): string | null {
  const mes = mesPrimeraCuotaPeriodo(semestrePeriodo)
  if (anioPeriodo == null || mes == null) return null
  const nombre = mes === 3 ? 'marzo' : 'agosto'
  return `${nombre} ${anioPeriodo}`
}
