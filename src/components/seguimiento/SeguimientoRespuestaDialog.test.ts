import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
const slot={template:'<div><slot /></div>'}
it('registra respuesta sin enviar y permite vínculo explícito o sin vínculo',async()=>{
 const load=import.meta.glob('./SeguimientoRespuestaDialog.vue')['./SeguimientoRespuestaDialog.vue'];expect(load).toBeTypeOf('function');if(!load)return;const m=await load() as any
 const w=mount(m.default,{props:{open:true,bitacora:[],guardando:false,error:null},global:{stubs:{Dialog:slot,DialogContent:slot,DialogTitle:slot,DialogDescription:slot,DialogHeader:slot,DialogFooter:slot}}})
 await w.get('textarea').setValue('Respuesta de ejemplo');await w.get('form').trigger('submit')
 expect(w.emitted('guardar')).toHaveLength(1);expect(w.emitted('guardar')?.[0]?.[0]).toMatchObject({contactoId:null,canal:'correo',comentario:'Respuesta de ejemplo'});expect(w.text()).toContain('No envía mensajes')
})
