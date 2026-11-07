// @vitest-environment jsdom
import { describe,it,expect,vi,afterEach } from 'vitest'
import { shallowMount, mount } from '@vue/test-utils'
import SeguimientoNotaDialog from './SeguimientoNotaDialog.vue'
import SeguimientoProximaAccion from './SeguimientoProximaAccion.vue'
const field=(tag:string)=>({props:['modelValue'],emits:['update:modelValue'],template:`<${tag} :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`})
function montar(){return shallowMount(SeguimientoNotaDialog,{props:{open:true,guardando:false},global:{renderStubDefaultSlot:true,stubs:{Input:field('input'),Textarea:field('textarea'),Button:{template:'<button><slot /></button>'}}}})}
describe('modal Nota v2',()=>{
 afterEach(()=>vi.useRealTimers())
 it('predetermina ahora en Chile y requiere comentario',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-07T17:15:00Z'))
  const w=montar()
  expect((w.get('#nota-fecha').element as HTMLInputElement).value).toBe('2026-11-07T14:15')
  expect((w.get('#nota-canal').element as HTMLSelectElement).value).toBe('llamada')
  await w.get('form').trigger('submit')
  expect(w.get('[role="alert"]').text()).toMatch(/comentario/i)
  expect(w.emitted('guardar')).toBeUndefined()
  expect(w.get('[role="group"]').classes()).toContain('flex-wrap')
  w.unmount()
 })
 it('valida tarjeta opcional y emite ambos canales con fechas ISO',async()=>{
  const w=montar()
  await w.get('#nota-comentario').setValue('Contesto, solicita contacto')
  await w.get('#nota-fecha').setValue('2026-11-07T14:15')
  await w.get('#accion-comentario').setValue('Confirmar pago')
  await w.get('form').trigger('submit')
  expect(w.get('[role="alert"]').text()).toMatch(/fecha/i)
  await w.get('#accion-fecha').setValue('2026-11-10T10:00')
  await w.get('form').trigger('submit')
  expect(w.get('[role="alert"]').text()).toMatch(/canal/i)
  for(const label of ['Llamada','SMS'])await w.findAll('button').find(b=>b.text().includes(label))!.trigger('click')
  await w.get('form').trigger('submit')
  expect(w.emitted('guardar')?.[0]?.[0]).toMatchObject({canal:'llamada',nota:'Contesto, solicita contacto',fecha_contacto:'2026-11-07T17:15:00.000Z',proxima_accion_at:'2026-11-10T13:00:00.000Z',proxima_accion_canales:['llamada','sms'],proxima_accion_comentario:'Confirmar pago'})
  await w.setProps({open:false});await w.setProps({open:true})
  expect((w.get('#nota-comentario').element as HTMLTextAreaElement).value).toBe('')
  expect(w.findAll('[aria-pressed="true"]')).toHaveLength(0)
  w.unmount()
 })
 it('muestra vencida en rojo, canales y compatibilidad de texto antiguo',()=>{
  const w=mount(SeguimientoProximaAccion,{props:{at:'2020-11-10T13:00:00Z',canales:['llamada','sms'],comentario:'Confirmar'}})
  expect(w.classes()).toContain('text-red-700')
  expect(w.text()).toContain('Vencida');expect(w.text()).toContain('Llamada');expect(w.text()).toContain('SMS');expect(w.text()).toContain('10:00')
  w.unmount()
  const legacy=mount(SeguimientoProximaAccion,{props:{legacy:'Llamar el lunes'}})
  expect(legacy.text()).toBe('Llamar el lunes');legacy.unmount()
 })
 it('conserva texto legacy cuando existía una fecha pero no canales estructurados',()=>{
  const w=mount(SeguimientoProximaAccion,{props:{at:'2020-11-10T13:00:00Z',legacy:'Llamar el lunes'}})
  expect(w.text()).toContain('Llamar el lunes');w.unmount()
 })

})
