const FECHA_HORA_CHILE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Santiago',
  dateStyle: 'short',
  timeStyle: 'medium',
}

/** Formatea ISO/timestamp para mostrar en hora de Santiago (Chile). */
export function formatearFechaHoraChile(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', FECHA_HORA_CHILE_OPTS)
}
