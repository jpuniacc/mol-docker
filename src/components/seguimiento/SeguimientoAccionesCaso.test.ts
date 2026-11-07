import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
it('gestiona cada pendiente y no ofrece acciones sobre terminales',async()=>{
 const mod=await import('./SeguimientoAccionesCaso.vue').catch(()=>null)
 expect(mod,'Falta tarjeta de gestión aprobada').not.toBeNull()
 if(!mod)return
 const w=mount(mod.default,{props:{acciones:[{id:'p',proxima_accion_at:'2026-11-06T12:00:00Z',proxima_accion_estado:'pendiente',proxima_accion_canales:['correo']},{id:'c',proxima_accion_at:'2026-11-06T12:00:00Z',proxima_accion_estado:'completada'}] as any[]}})
 const buttons=w.findAll('button')
 expect(buttons).toHaveLength(2)
 await buttons[0].trigger('click')
 expect(w.emitted('gestionar')?.[0]).toEqual([{id:'p',estado:'completada'}])
 expect(w.text()).toContain('Completada')
})
