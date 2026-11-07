import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
it('tarjeta móvil preserva caso y abre con botón accesible',async()=>{
 const load=import.meta.glob('./SeguimientoCasoCard.vue')['./SeguimientoCasoCard.vue'];expect(load).toBeTypeOf('function');if(!load)return;const m=await load() as any
 const fila={codcli:'C1',nombre_alumno:'Alumno ejemplo',chip:'forma_pago',nombre_carrera:'Diseño'} as any
 const w=mount(m.default,{props:{fila}});expect(w.text()).toContain('Alumno ejemplo');await w.get('button').trigger('click');expect(w.emitted('abrir')?.[0]).toEqual([fila])
})
