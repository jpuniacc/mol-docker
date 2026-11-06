export type EstadoOutboxUi = 'n/a' | 'pdte' | 'enviado'

export function estadoOutboxUi(input: {
  aplicaRetencionP: boolean
  fila: { estado: string; sent_at: string | null } | null
}): EstadoOutboxUi {
  if (!input.aplicaRetencionP) return 'n/a'
  if (!input.fila) return 'n/a'
  if (input.fila.estado === 'enviado') return 'enviado'
  if (input.fila.estado === 'pendiente') return 'pdte'
  return 'n/a'
}

export function etiquetaOutboxUi(estado: EstadoOutboxUi, sentAt?: string | null): string {
  if (estado === 'n/a') return 'n/a'
  if (estado === 'pdte') return 'pdte'
  if (sentAt) {
    const d = new Date(sentAt)
    if (!Number.isNaN(d.getTime())) {
      return `enviado ${d.toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    }
  }
  return 'enviado'
}
