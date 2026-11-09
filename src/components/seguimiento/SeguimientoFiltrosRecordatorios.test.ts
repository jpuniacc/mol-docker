import {test,expect} from 'vitest'
import {mount} from '@vue/test-utils'
const mods=import.meta.glob('./SeguimientoFiltrosRecordatorios.vue')
test('three labelled combinable filters emit copied model, preserving old filters and not mutating props',async()=>{
 expect(mods['./SeguimientoFiltrosRecordatorios.vue']).toBeTypeOf('function');const c:any=(await mods['./SeguimientoFiltrosRecordatorios.vue']!() as any).default,model={recordatorio_estado:'error',recordatorio_etapa:'datos'}
 const w=mount(c,{props:{modelValue:model}});expect(w.findAll('label')).toHaveLength(3);await w.findAll('select')[2]!.setValue('sms');expect(w.emitted('update:modelValue')![0]![0]).toEqual({...model,recordatorio_canal:'sms'});expect(model).not.toHaveProperty('recordatorio_canal')
})
