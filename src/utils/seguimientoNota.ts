const ZONA = 'America/Santiago'
export const CANALES_ACCION = [
  { value: 'llamada', label: 'Llamada' }, { value: 'correo', label: 'Correo' },
  { value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' },
] as const
export type NotaContactoPayload = {
  canal: string
  nota: string
  fecha_contacto: string
  proxima_accion_at: string | null
  proxima_accion_canales: string[]
  proxima_accion_comentario: string | null
}
export type NotaFormulario = {
  canal: string; nota: string; fecha_contacto: string
  proxima_fecha: string; proxima_canales: string[]; proxima_comentario: string
}
export function fechaHoraChileInput(iso: string | Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const p = (tipo: string) => partes.find(x=>x.type===tipo)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`
}
/** Convierte hora civil chilena sin usar la zona del navegador; rechaza huecos DST. */
export function fechaHoraChileIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const target = Date.parse(`${local}:00Z`)
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0,16) !== local) return null
  const offsets = new Set<number>()
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = target + delta
    const civil = Date.parse(`${fechaHoraChileInput(new Date(sample))}:00Z`)
    offsets.add(civil - sample)
  }
  const candidatos = [...offsets].map(offset=>target-offset).filter(t=>fechaHoraChileInput(new Date(t))===local).sort((a,b)=>a-b)
  return candidatos.length ? new Date(candidatos[0]).toISOString() : null
}
export function prepararNotaFormulario(form: NotaFormulario): {data: NotaContactoPayload | null; error: string | null} {
  const fail = (error: string) => ({data:null,error})
  if (!form.nota.trim()) return fail('El comentario de la nota es obligatorio.')
  if (form.nota.trim().length > 10000 || form.proxima_comentario.trim().length > 10000) return fail('El comentario no puede superar 10000 caracteres.')
  const fecha_contacto = fechaHoraChileIso(form.fecha_contacto)
  if (!fecha_contacto) return fail('Indica una fecha y hora de contacto válida (Chile).')
  const agenda = Boolean(form.proxima_fecha || form.proxima_canales.length || form.proxima_comentario.trim())
  const proxima_accion_at = form.proxima_fecha ? fechaHoraChileIso(form.proxima_fecha) : null
  if (agenda && !proxima_accion_at) return fail('La próxima acción requiere fecha y hora válida (Chile).')
  if (agenda && !form.proxima_canales.length) return fail('Selecciona al menos un canal para la próxima acción.')
  if (form.proxima_canales.some(c=>!CANALES_ACCION.some(x=>x.value===c))) return fail('Canal de próxima acción inválido.')
  return {error:null,data:{canal:form.canal,nota:form.nota.trim(),fecha_contacto,proxima_accion_at,proxima_accion_canales:[...new Set(form.proxima_canales)],proxima_accion_comentario:form.proxima_comentario.trim()||null}}
}
export function esAccionVencida(at: string | null | undefined, ahora = new Date()): boolean {
  if (!at || !Number.isFinite(Date.parse(at))) return false
  const dia = (d: Date) => new Intl.DateTimeFormat('en-CA', {timeZone:ZONA,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
  return dia(new Date(at)) < dia(ahora)
}
export function etiquetaFechaChile(at: string): string {
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? 'Fecha no disponible' : d.toLocaleString('es-CL',{timeZone:ZONA,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
}
