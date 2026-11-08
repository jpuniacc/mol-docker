// @vitest-environment jsdom
import { describe,it,expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SeguimientoTimelineEvento from './SeguimientoTimelineEvento.vue'
import type { ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'
const base:ContactoSeguimiento={id:'1',canal:'correo',origen:'manual',autor_email:'consejero@uniacc.cl',nota:'[plantilla:recordatorio_firma] asunto=Contrato por firmar | preview=Hola alumno',resultado:null,proxima_accion:null,proxima_accion_en:null,created_at:'2026-11-07T18:00:00Z',fecha_contacto:'2026-11-07T17:15:00Z'}
describe('tarjetas de todos los eventos',()=>{
 it('cabecera tipo, título y autor/fecha real; tarjeta y subacordeones cerrados',()=>{
  const w=mount(SeguimientoTimelineEvento,{props:{evento:base}})
  const tarjeta=w.get('details[data-evento-id="1"]')
  expect((tarjeta.element as HTMLDetailsElement).open).toBe(false)
  const header=tarjeta.get('summary')
  expect(header.text()).toContain('Correo');expect(header.text()).toContain('Contrato por firmar')
  expect(header.text()).toContain('consejero@uniacc.cl');expect(header.text()).toContain('14:15')
  expect(header.text()).not.toContain('Hola alumno')
  expect(w.findAll('details')).toHaveLength(3)
  for(const d of w.findAll('details'))expect((d.element as HTMLDetailsElement).open).toBe(false)
  expect(w.text()).toContain('recordatorio_firma');expect(w.text()).toContain('Hola alumno')
  w.unmount()
 })
 it('SMS y sistema usan la misma tarjeta y no muestran metadatos internos en el título',()=>{
  for(const item of [{...base,canal:'sms',nota:'[sms] texto=Mensaje de prueba'},{...base,canal:'webpay',origen:'sistema',nota:'[hito:matricula:123] Matrícula pagada'}]){
   const w=mount(SeguimientoTimelineEvento,{props:{evento:item}})
   expect((w.get('details').element as HTMLDetailsElement).open).toBe(false)
   expect(w.get('summary').text()).not.toMatch(/\[hito:|\[sms\]/)
   if(item.origen==='sistema')expect(w.get('summary').text()).toContain('Sistema')
   w.unmount()
  }
 })
 it('el cuerpo contiene agenda y comentario sin interpretar HTML',()=>{
  const w=mount(SeguimientoTimelineEvento,{props:{evento:{...base,canal:'llamada',nota:'Llamó para consultar\nDetalle privado',proxima_accion_at:'2026-11-10T13:00:00Z',proxima_accion_canales:['llamada','sms'],proxima_accion_comentario:'Confirmar <script>bad()</script>'}}})
  expect(w.get('summary').text()).toContain('Llamó para consultar')
  expect(w.get('summary').text()).not.toContain('Detalle privado')
  expect(w.text()).toContain('SMS');expect(w.text()).toContain('Detalle privado')
  expect(w.find('script').exists()).toBe(false)
  w.unmount()
 })
})

it('respuesta manual se distingue y no interpreta comentario como HTML/plantilla',()=>{
 const evento:any={id:'respuesta',canal:'correo',origen:'manual',autor_email:'a@uniacc.cl',created_at:'2026-11-07T15:00:00Z',es_respuesta:true,nota:'<img src=x onerror=alert(1)>',resultado:'Respuesta registrada'}
 const w=mount(SeguimientoTimelineEvento,{props:{evento}});expect(w.text()).toContain('Alumno respondió');expect(w.find('img').exists()).toBe(false)
})
