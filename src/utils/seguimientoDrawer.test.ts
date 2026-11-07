import { describe, it, expect } from 'vitest'
import { formatearTelefono, tipoEvento, paginaTimeline, agruparTimeline, leerFiltroTimeline, guardarFiltroTimeline } from './seguimientoDrawer'
const evento = (id: number, canal = 'correo', origen = 'manual', created_at = '2026-11-07T14:00:00Z') => ({ id: String(id), canal, origen, created_at, autor_email: 'test@uniacc.cl', nota: null, resultado: null, proxima_accion: null, proxima_accion_en: null })
describe('drawer CRM', () => {
 it('formatea móvil sin alterar datos desconocidos', () => {
  for (const v of ['964255300','56964255300','+56 9 6425 5300','0964255300']) expect(formatearTelefono(v)).toBe('+56 9 6425 5300')
  expect(formatearTelefono(null)).toBe('—')
  expect(formatearTelefono('123')).toBe('123')
 })
 it('clasifica sistema primero y conserva canales manuales como notas', () => {
  expect(tipoEvento(evento(1,'correo','sistema'))).toBe('sistema')
  for (const c of ['correo','email','mail']) expect(tipoEvento(evento(1,c,'auto'))).toBe('correo')
  expect(tipoEvento(evento(1,'sms','auto'))).toBe('sms')
  expect(tipoEvento(evento(1,'whatsapp'))).toBe('whatsapp')
  for (const c of ['llamada','presencial','nota','otro']) expect(tipoEvento(evento(1,c))).toBe('nota')
 })
 it('pagina de diez en diez, filtra antes de paginar y cuenta todos los eventos', () => {
  const items=Array.from({length:25},(_,i)=>evento(i,i<12?'sms':'correo'))
  const primera=paginaTimeline(items,'todos',10)
  expect(primera.eventos).toHaveLength(10)
  expect(primera.restantes).toBe(15)
  expect(primera.conteos).toMatchObject({todos:25,sms:12,correo:13,nota:0})
  expect(paginaTimeline(items,'sms',10).restantes).toBe(2)
  expect(paginaTimeline(items,'sms',20).eventos).toHaveLength(12)
  expect(paginaTimeline(items,'sistema',10).eventos).toEqual([])
 })
 it('ordena descendente sin mutar la fuente', () => {
  const items=[evento(1,'nota','manual','2026-11-06T14:00:00Z'),evento(2)]
  expect(paginaTimeline(items,'todos',10).eventos.map(x=>x.id)).toEqual(['2','1'])
  expect(items[0].id).toBe('1')
 })
 it('agrupa Hoy y Ayer por día chileno, no UTC; incluye fin de mes y fechas inválidas', () => {
  const now=new Date('2026-11-08T01:00:00Z')
  const grupos=agruparTimeline([evento(1,'sms','manual','2026-11-08T00:30:00Z'),evento(2,'sms','manual','2026-11-07T01:00:00Z'),evento(3,'sms','manual','2026-10-31T15:00:00Z'),evento(4,'sms','manual','invalid')],now)
  expect(grupos.map(g=>g.label)).toEqual(['Hoy','Ayer','31-10-2026','Sin fecha'])
  expect(agruparTimeline([evento(1,'nota','manual','2026-10-31T15:00:00Z')],new Date('2026-11-01T16:00:00Z'))[0].label).toBe('Ayer')
 })
 it('recuerda solo filtros válidos y tolera almacenamiento bloqueado', () => {
  const values=new Map<string,string>()
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}}
  expect(leerFiltroTimeline(storage)).toBe('todos')
  guardarFiltroTimeline('sms',storage)
  expect(leerFiltroTimeline(storage)).toBe('sms')
  expect(leerFiltroTimeline({getItem:()=> 'invalido'})).toBe('todos')
  const bloqueado={getItem:()=>{throw Error('bloqueado')},setItem:()=>{throw Error('bloqueado')}}
  expect(leerFiltroTimeline(bloqueado)).toBe('todos')
  expect(()=>guardarFiltroTimeline('nota',bloqueado)).not.toThrow()
 })
})
