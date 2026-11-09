import {test,expect} from 'vitest'
import {mount} from '@vue/test-utils'
const mods=import.meta.glob('./SeguimientoRecordatorios.vue')
const base:any={id:'one',etapa:'datos',canal:'correo',estado:'enviado',etapa_desde:'2026-11-01 12:00:00.123456+00',programado_para:'2026-11-02T12:00:00Z',enviado_at:'2026-11-03T12:00:00Z',origen:'etapa',variante:'datos',resultado_incierto:false,asunto:'<script>no ejecutar</script>',destinatario:'fixture@example.test',cc:'cc@example.test',preparado_en:'2026-11-03T12:00:00Z'}
async function component(){expect(mods['./SeguimientoRecordatorios.vue']).toBeTypeOf('function');return (await mods['./SeguimientoRecordatorios.vue']!() as any).default}
test('unknown history is not a fictional empty history; empty available is explicit',async()=>{
 const c=await component(),w=mount(c,{props:{items:[],disponible:false}});expect(w.text()).toContain('Histórico no disponible');await w.setProps({disponible:true});expect(w.text()).toContain('Sin recordatorios')
})
test('mobile condensed history expands every stage and channel without losing ids',async()=>{
 const w=mount(await component(),{props:{disponible:true,items:[base,{...base,id:'two',etapa:'tyc',canal:'sms',estado:'cancelado'},{...base,id:'three',estado:'error',resultado_incierto:true}]}})
 expect(w.findAll('[data-recordatorio-id]')).toHaveLength(2);const b=w.get('button');expect(b.attributes('aria-expanded')).toBe('false');await b.trigger('click');expect(w.findAll('[data-recordatorio-id]')).toHaveLength(3);expect(w.text()).toContain('Resultado incierto');expect(b.attributes('aria-expanded')).toBe('true')
})
test('closed native accordions, explicit status not only color, escaped details and Chile dates',async()=>{
 const w=mount(await component(),{props:{disponible:true,detalles:true,items:[base,{...base,id:'one'},{...base,id:'cancel',estado:'cancelado'}]}})
 expect(w.findAll('details')).toHaveLength(2);expect(w.get('details').attributes('open')).toBeUndefined();expect(w.text()).toContain('America/Santiago');expect(w.text()).toContain(base.asunto);expect(w.find('script').exists()).toBe(false);expect(w.text()).toContain('Cancelado');expect(w.text()).toContain('Preparado');expect(w.text()).toContain('CC:')
})
test('drawer/timeline shared accordions retain both actual AB reasons and cancelled uncertainty',async()=>{
 const w=mount(await component(),{props:{disponible:true,detalles:true,items:[{...base,id:'advance',estado:'cancelado',cancelacion_motivo:'etapa_o_elegibilidad_cambio'},{...base,id:'signature',estado:'cancelado',cancelacion_motivo:'firma_completa',resultado_incierto:true}]}})
 expect(w.text()).toContain('La etapa o elegibilidad cambió');expect(w.text()).toContain('Firma completa');expect(w.text()).toContain('Cancelado');expect(w.text()).toContain('Resultado incierto');expect(w.get('[data-recordatorio-id="signature"] summary span').classes()).toContain('bg-zinc-100')
 for(const d of w.findAll('details'))expect(d.attributes('open')).toBeUndefined()
})
test('compact cancellation title uses safe reason label; unknown contact/provider text is never shown',async()=>{
 const w=mount(await component(),{props:{disponible:true,items:[{...base,estado:'cancelado',cancelacion_motivo:'firma_completa'}]}});expect(w.get('[data-recordatorio-id]').attributes('title')).toContain('Firma completa')
 await w.setProps({detalles:true,items:[{...base,estado:'cancelado',cancelacion_motivo:'student-secret@example.test 56912345678'}]});expect(w.text()).toContain('Motivo no disponible');expect(w.text()).not.toContain('student-secret');expect(w.text()).not.toContain('56912345678')
})
