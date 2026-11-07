import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
const slot={template:'<div><slot /></div>'}
it('filtros editan borrador; aplicar emite una vez y cancelar no aplica',async()=>{
 const load=import.meta.glob('./SeguimientoFiltrosSheet.vue')['./SeguimientoFiltrosSheet.vue'];expect(load).toBeTypeOf('function');if(!load)return;const m=await load() as any
 const value={chip:null,subetapa:null,filtroAux:null,ejecutivo:''}
 const w=mount(m.default,{props:{open:true,value,supervisor:false,ejecutivos:[],periodo:'2027-1'},global:{stubs:{Sheet:slot,SheetContent:slot,SheetTitle:slot,SheetDescription:slot}}})
 await w.get('select[name=etapa]').setValue('forma_pago');expect(w.emitted('aplicar')).toBeUndefined();expect(w.find('select[name=ejecutivo]').exists()).toBe(false)
 await w.get('form').trigger('submit');expect(w.emitted('aplicar')).toHaveLength(1);expect(w.emitted('aplicar')?.[0]?.[0]).toMatchObject({chip:'forma_pago'})
 await w.setProps({open:false});await w.setProps({open:true});expect((w.get('select[name=etapa]').element as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('Todas')
 await w.findAll('button').find(b=>b.text()==='Cancelar')!.trigger('click');expect(w.emitted('aplicar')).toHaveLength(1)
})
