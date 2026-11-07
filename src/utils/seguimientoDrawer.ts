import type { ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'

export const FILTROS_TIMELINE = [
  { tipo: 'todos', label: 'Todos' },
  { tipo: 'correo', label: 'Correo' },
  { tipo: 'sms', label: 'SMS' },
  { tipo: 'whatsapp', label: 'WhatsApp' },
  { tipo: 'nota', label: 'Nota' },
  { tipo: 'sistema', label: 'Sistema' },
] as const
export type FiltroTimeline = (typeof FILTROS_TIMELINE)[number]['tipo']
const STORAGE_KEY = 'mol.seguimiento.timeline.filtro.v1'
const ZONA = 'America/Santiago'

export function formatearTelefono(valor: string | null | undefined): string {
  if (!valor?.trim()) return '—'
  let n = valor.replace(/\D/g, '')
  if (/^0?9\d{8}$/.test(n)) n = `56${n.replace(/^0/, '')}`
  return /^569\d{8}$/.test(n) ? `+56 9 ${n.slice(3, 7)} ${n.slice(7)}` : valor.trim()
}

export function tipoEvento(ev: Pick<ContactoSeguimiento, 'canal' | 'origen'>): Exclude<FiltroTimeline, 'todos'> {
  if (ev.origen.trim().toLowerCase() === 'sistema') return 'sistema'
  const canal = ev.canal.trim().toLowerCase()
  if (['correo', 'email', 'mail'].includes(canal)) return 'correo'
  if (canal === 'sms') return 'sms'
  if (canal === 'whatsapp') return 'whatsapp'
  return 'nota'
}

export function paginaTimeline(items: ContactoSeguimiento[], filtro: FiltroTimeline, limite: number) {
  const conteos: Record<FiltroTimeline, number> = { todos: items.length, correo: 0, sms: 0, whatsapp: 0, nota: 0, sistema: 0 }
  for (const ev of items) conteos[tipoEvento(ev)]++
  const filtrados = items.filter((ev) => filtro === 'todos' || tipoEvento(ev) === filtro)
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  return { eventos: filtrados.slice(0, limite), restantes: Math.max(0, filtrados.length - limite), total: filtrados.length, conteos }
}

function claveDia(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) return 'sin-fecha'
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

export function agruparTimeline(items: ContactoSeguimiento[], ahora = new Date()) {
  const hoy = claveDia(ahora)
  // Aritmética de calendario, no restar 24h: respeta cambios de horario de Chile.
  const ayerFecha = new Date(`${hoy}T12:00:00Z`)
  ayerFecha.setUTCDate(ayerFecha.getUTCDate() - 1)
  const ayer = ayerFecha.toISOString().slice(0, 10)
  const grupos: Array<{ key: string; label: string; eventos: ContactoSeguimiento[] }> = []
  for (const ev of items) {
    const key = claveDia(new Date(ev.created_at))
    let grupo = grupos.find((g) => g.key === key)
    if (!grupo) {
      const label = key === hoy ? 'Hoy' : key === ayer ? 'Ayer' : key === 'sin-fecha' ? 'Sin fecha' : key.split('-').reverse().join('-')
      grupo = { key, label, eventos: [] }
      grupos.push(grupo)
    }
    grupo.eventos.push(ev)
  }
  return grupos
}

export function leerFiltroTimeline(storage?: Pick<Storage, 'getItem'>): FiltroTimeline {
  try {
    const valor = (storage ?? localStorage).getItem(STORAGE_KEY)
    return FILTROS_TIMELINE.find((f) => f.tipo === valor)?.tipo ?? 'todos'
  } catch { return 'todos' }
}

export function guardarFiltroTimeline(filtro: FiltroTimeline, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? localStorage).setItem(STORAGE_KEY, filtro) } catch { /* Navegación privada: filtro solo en memoria. */ }
}
